import { describe, it, expect, vi, beforeEach } from 'vitest';
import { grantAttempts, AttemptGrantError } from '../attempt-grants';

/**
 * grantAttempts — üç "ek hak verme" yolunun (talep onayı / personel sayfası / sıfırla)
 * ortak çekirdeği. Burada doğrulanan sözleşme her üç route için de geçerlidir:
 *  - (trainingId,userId) hedefinde en yeni round deterministik + tenant filtresiyle çözülür (N1),
 *  - terminal (passed/locked) atama reddedilir (state-machine),
 *  - notify/reconcile opsiyonel ve tutarlı.
 */

function makeTx() {
  return {
    trainingAssignment: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    examAttemptRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
}

/** Mock tx'i helper imzasına dök (any kullanmadan). */
const asTx = (t: ReturnType<typeof makeTx>) => t as unknown as Parameters<typeof grantAttempts>[0];

const baseAssignment = {
  id: 'asgn-new',
  userId: 'user-1',
  trainingId: 'tr-1',
  status: 'failed',
  maxAttempts: 3,
  currentAttempt: 3,
  originalMaxAttempts: 3,
  training: { title: 'Yangın Güvenliği' },
  user: { firstName: 'Ali', lastName: 'Veli' },
};

describe('grantAttempts — ortak ek-hak helper', () => {
  let tx: ReturnType<typeof makeTx>;
  beforeEach(() => { tx = makeTx(); });

  it('(trainingId,userId) hedefinde en yeni round deterministik + tenant filtresiyle çözülür (N1)', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: (a) => a.maxAttempts + 2,
    });
    const call = tx.trainingAssignment.findFirst.mock.calls[0][0];
    expect(call.where).toMatchObject({ trainingId: 'tr-1', userId: 'user-1', organizationId: 'org-1' });
    expect(call.orderBy).toEqual([{ round: 'desc' }, { assignedAt: 'desc' }]);
  });

  it('assignmentId hedefinde id + organizationId ile çözülür', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { assignmentId: 'asgn-x' },
      computeNewMax: () => 6,
    });
    const call = tx.trainingAssignment.findFirst.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: 'asgn-x', organizationId: 'org-1' });
  });

  it('computeNewMax sonucu çözülen atamaya yazılır (status assigned + completedAt null)', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    const res = await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: (a) => a.maxAttempts + 2,
    });
    const upd = tx.trainingAssignment.update.mock.calls[0][0];
    expect(upd.where.id).toBe('asgn-new');
    expect(upd.data).toMatchObject({ status: 'assigned', maxAttempts: 5, completedAt: null });
    expect(res.newMaxAttempts).toBe(5);
    expect(res.userName).toBe('Ali Veli');
  });

  it('atama yoksa ASSIGNMENT_NOT_FOUND fırlatır, update çağrılmaz', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(null);
    await expect(grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: () => 5,
    })).rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_FOUND' });
    expect(tx.trainingAssignment.update).not.toHaveBeenCalled();
  });

  it.each(['passed', 'locked'])('terminal "%s" atama reddedilir (INVALID_TRANSITION), update/bildirim yok', async (status) => {
    tx.trainingAssignment.findFirst.mockResolvedValue({ ...baseAssignment, status });
    await expect(grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { assignmentId: 'asgn-x' },
      computeNewMax: () => 5,
      notify: { title: 'x', message: () => 'y' },
    })).rejects.toBeInstanceOf(AttemptGrantError);
    expect(tx.trainingAssignment.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('notify verilince personele bildirim oluşturulur (training title ile)', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: () => 5,
      notify: { title: 'Onaylandı', message: (t) => `${t} için hak verildi` },
    });
    const n = tx.notification.create.mock.calls[0][0];
    expect(n.data).toMatchObject({
      userId: 'user-1', organizationId: 'org-1', title: 'Onaylandı',
      message: 'Yangın Güvenliği için hak verildi', relatedTrainingId: 'tr-1',
    });
  });

  it('notify yoksa bildirim oluşturulmaz', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: () => 5,
    });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('reconcilePendingRequest ile bekleyen talep approved yapılır (yetim/çift-hak önlenir)', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-9',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: () => 5,
      reconcilePendingRequest: true,
      grantedAttemptsForReconcile: 2,
    });
    const u = tx.examAttemptRequest.updateMany.mock.calls[0][0];
    expect(u.where).toMatchObject({ trainingId: 'tr-1', userId: 'user-1', status: 'pending' });
    expect(u.data).toMatchObject({ status: 'approved', reviewedById: 'admin-9', grantedAttempts: 2 });
  });

  it('reconcile yoksa updateMany çağrılmaz', async () => {
    tx.trainingAssignment.findFirst.mockResolvedValue(baseAssignment);
    await grantAttempts(asTx(tx), {
      organizationId: 'org-1', reviewerId: 'admin-1',
      target: { trainingId: 'tr-1', userId: 'user-1' },
      computeNewMax: () => 5,
    });
    expect(tx.examAttemptRequest.updateMany).not.toHaveBeenCalled();
  });
});
