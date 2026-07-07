'use client';

import { useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { ChannelsTab } from './_components/channels-tab';
import { ApiKeysTab } from './_components/api-keys-tab';
import { FieldMappingTab } from './_components/field-mapping-tab';
import { PullSettingsTab } from './_components/pull-settings-tab';
import { RunsTab } from './_components/runs-tab';
import { UpsellScreen } from './_components/upsell-screen';
import { type IntegrationListResponse } from './_components/types';

const CONFIG_URL = '/api/admin/integration';

const TABS = [
  { key: 'channels', label: 'Kanallar' },
  { key: 'keys', label: 'API Anahtarları' },
  { key: 'mapping', label: 'Alan Eşleme' },
  { key: 'pull', label: 'Pull Ayarları' },
  { key: 'runs', label: 'Geçmiş' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function IntegrationSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('channels');
  const { data, isLoading, error, refetch } = useFetch<IntegrationListResponse>(CONFIG_URL);

  if (isLoading) return <PageLoading />;

  // Feature gate: API 403 gövdesindeki mesaj useFetch error'ı olarak gelir.
  if (error && error.includes('planınızda etkin değil')) {
    return <UpsellScreen />;
  }

  const configs = data?.integrations ?? [];
  const pullConfig = configs.find((c) => c.channel === 'pull');

  const refreshConfigs = () => {
    invalidateFetchCache(CONFIG_URL);
    refetch();
  };

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span>Ayarlar</span>
              <ChevronRight size={12} />
              <span data-current="true">Entegrasyon</span>
            </div>
            <h1 className="k-page-title">İK / HBYS Entegrasyonu</h1>
            <p className="k-page-subtitle">
              Personel listenizi İK veya HBYS sisteminizle otomatik senkronize edin — push,
              gecelik dosya veya API üzerinden çekme.
            </p>
          </div>
        </header>
      </BlurFade>

      {error ? (
        <BlurFade delay={0.05}>
          <div
            className="rounded-2xl border p-10 text-center"
            style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
          >
            <p className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</p>
            <button onClick={refetch} className="k-btn k-btn-ghost mt-4">
              <RefreshCw className="h-4 w-4" /> Tekrar Dene
            </button>
          </div>
        </BlurFade>
      ) : (
        <>
          <BlurFade delay={0.05}>
            <div className="k-tabs max-w-full overflow-x-auto" role="tablist" aria-label="Entegrasyon sekmeleri">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  data-active={activeTab === tab.key ? 'true' : undefined}
                  onClick={() => setActiveTab(tab.key)}
                  className="k-tab"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </BlurFade>

          <BlurFade delay={0.1}>
            {activeTab === 'channels' && <ChannelsTab configs={configs} onSaved={refreshConfigs} />}
            {activeTab === 'keys' && <ApiKeysTab />}
            {activeTab === 'mapping' && <FieldMappingTab configs={configs} onSaved={refreshConfigs} />}
            {activeTab === 'pull' && <PullSettingsTab config={pullConfig} onSaved={refreshConfigs} />}
            {activeTab === 'runs' && <RunsTab />}
          </BlurFade>
        </>
      )}
    </div>
  );
}
