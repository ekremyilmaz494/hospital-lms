# Hastane LMS — Yonetici Kullanim Kilavuzu

Bu kilavuz, Hastane LMS platformunun hastane yoneticileri (admin) tarafindan nasil kullanilacagini adim adim aciklamaktadir. Kilavuz boyunca ekran goruntuleri yerine metin tabanli aciklamalar tercih edilmistir; her bolum gunluk islerinizde size yol gosterecek pratik bilgiler icerir.

---

## Icindekiler

1. [Giris ve Ilk Kurulum](#1-giris-ve-ilk-kurulum)
2. [Gosterge Paneli](#2-gosterge-paneli)
3. [Personel Yonetimi](#3-personel-yonetimi)
4. [Egitim Yonetimi](#4-egitim-yonetimi)
5. [Sinav Sistemi](#5-sinav-sistemi)
6. [Sertifika Yonetimi](#6-sertifika-yonetimi)
7. [Raporlama](#7-raporlama)
8. [Bildirimler](#8-bildirimler)
9. [Ayarlar](#9-ayarlar)
10. [Sikca Sorulan Sorular](#10-sikca-sorulan-sorular)

---

## 1. Giris ve Ilk Kurulum

### Sisteme Giris

Hastane LMS'e erisim icin tarayicinizda kurumunuza ait adresi acin (ornegin `hastane.hastanelms.com`). Karsiniza giris ekrani gelecektir. Super Admin tarafindan size iletilen e-posta adresi ve gecici sifre ile giris yapin. Ilk girisinizdeki gecici sifre yalnizca bir kez gecerlidir; sistem sizi otomatik olarak sifre degistirme ekranina yonlendirecektir.

### Sifre Degistirme

Ilk giris sonrasi acilan sifre degistirme ekraninda yeni sifrenizi belirleyin. Sifreniz en az 8 karakter uzunlugunda olmali ve en az bir buyuk harf, bir kucuk harf ve bir rakam icermelidir. Sifrenizi belirledikten sonra sistem sizi otomatik olarak gosterge paneline yonlendirir.

### Ilk Kurulum Adimlari

Ilk giris sonrasi yapmaniz gereken temel islemler sunlardir: Oncelikle "Ayarlar" bolumunden hastanenizin temel bilgilerini (ad, logo, iletisim) girin. Ardindan bolum/departman yapilanmanizi olusturun. Son olarak personellerinizi sisteme ekleyerek platformu kullanima hazir hale getirin. Bu adimlarin her biri ilerleyen bolumlerde ayrintili olarak anlatilmaktadir.

Giris yaptiginizda sol tarafta yer alan kenar cubugu (sidebar) uzerinden tum modullere erisebilirsiniz. Kenar cubugu; Gosterge Paneli, Personel, Egitimler, Sinavlar, Sertifikalar, Raporlar, Bildirimler ve Ayarlar gibi ana menulerden olusmaktadir.

---

## 2. Gosterge Paneli

### Genel Bakis

Gosterge paneli, sisteme giris yaptiginizda karsiniza cikan ilk ekrandir. Bu ekran hastanenize ait egitim ve personel verilerinin ozet gorunumunu sunar. Sayfanin ust kisminda yer alan istatistik kartlari size anlik durumu gosterir: Toplam Personel, Aktif Egitim, Tamamlanan Egitim ve Ortalama Basari Orani gibi temel metrikler burada goruntulenir.

### Grafikler ve Trendler

Istatistik kartlarinin altinda egitim tamamlama trendi, departman bazli basari oranlari ve aylik egitim istatistikleri gibi grafiklere erisebilirsiniz. Bu grafikler son 30 gunluk veriyi gosterir ve size egitim sureclerinin genel gidisati hakkinda hizli bir fikir verir. Grafiklerin uzerine fare ile geldiginizde detayli rakamlari gorebilirsiniz.

### Canli Sinav Takibi

Gosterge panelinin alt bolumunde "Devam Eden Sinavlar" alani bulunur. Bu alanda su anda sinava giren personelin listesini, kalan surelerini ve ilerleme durumlarini canli olarak takip edebilirsiniz. Canli takip ozelligi Supabase Realtime altyapisi ile calismaktadir ve sayfa yenilemesi gerektirmeden anlik guncelleme saglar.

### Hizli Erisim

Gosterge panelinde ayrica son eklenen egitimler, yaklasan son tarihi olan zorunlu egitimler ve bekleyen onay talepleri gibi hizli erisim alanlari da yer almaktadir. Bu alanlar sayesinde acil dikkat gerektiren konulara hizlica yonlenebilirsiniz.

---

## 3. Personel Yonetimi

### Personel Listesi ve Arama

Sol menuden "Personel" bolumune tiklayarak personel yonetim ekranina ulasin. Bu ekranda hastanenize kayitli tum personelin listesi tablo halinde goruntulenir. Tablo uzerinde ad-soyad, e-posta, departman, unvan ve durum (aktif/pasif) gibi bilgiler yer alir. Ust kisimda yer alan arama cubugu ve filtreler sayesinde belirli bir personeli hizlica bulabilir, departmana veya duruma gore filtreleme yapabilirsiniz.

### Yeni Personel Ekleme

Personel listesinin sag ust kosesindeki "Yeni Personel Ekle" butonuna tiklayin. Acilan formda personelin ad-soyad, e-posta adresi, TC kimlik numarasi, departman, unvan ve rol bilgilerini girin. Formu kaydettikten sonra sistem otomatik olarak personele bir davet e-postasi gonderir. Personel bu e-postadaki baglanti ile sifresini belirleyerek sisteme giris yapabilir.

### Toplu Personel Aktarimi (Bulk Import)

Cok sayida personeli tek tek eklemek yerine Excel dosyasi ile toplu aktarim yapabilirsiniz. "Toplu Aktar" butonuna tiklayarak ornek Excel sablonunu indirin. Sablonu personel bilgileri ile doldurup sisteme yukleyin. Sistem dosyayi kontrol ederek gecerli kayitlari otomatik olarak ekler, hatali satirlari ise size raporlar. Toplu aktarim sirasinda ayni e-posta adresi ile kayitli personel varsa ilgili satir atlanir ve uyari verilir.

### Personel Duzenleme ve Pasife Alma

Listede herhangi bir personelin uzerine tiklayarak detay ekranina ulasin. Bu ekranda personelin bilgilerini guncelleyebilir, departmanini degistirebilir veya hesabini pasife alabilirsiniz. Pasife alinan personel sisteme giris yapamaz ancak gecmis egitim ve sinav kayitlari silinmez. Ihtiyac durumunda personeli tekrar aktife alabilirsiniz.

### Departman Yonetimi

Personel bolumunun alt menusu olan "Departmanlar" sayfasindan hastanenizin organizasyon yapisini tanimlayabilirsiniz. Yeni departman ekleyebilir, mevcut departmanlari duzenleyebilir veya bos departmanlari silebilirsiniz. Her departmana bir yonetici atayabilir ve departman bazli egitim atamalari yapabilirsiniz.

---

## 4. Egitim Yonetimi

### Egitim Listesi

Sol menuden "Egitimler" bolumune giderek mevcut egitimlerin listesine ulasin. Bu listede her egitimin adi, kategorisi, suresi, durumu (taslak/yayinda/arsiv) ve atanmis personel sayisi goruntulenir. Filtreleme ve siralama secenekleri ile ihtiyaciniz olan egitimi kolayca bulabilirsiniz.

### 4 Adimli Egitim Olusturma Sihirbazi

Yeni bir egitim olusturmak icin "Yeni Egitim" butonuna tiklayin. Sistem sizi dort adimli bir sihirbaz ile yonlendirir:

**Adim 1 - Temel Bilgiler:** Egitimin adi, aciklamasi, kategorisi, suresi ve gecerlilik tarihini girin. Egitimin zorunlu olup olmadigini ve tekrar periyodunu (ornegin yilda bir) bu adimda belirleyin.

**Adim 2 - Video Icerikler:** Egitim videolarini yukleyin veya mevcut video kutuphanesinden secin. Videolarin sirasini surukle-birak ile duzenleyin. Videolar AWS S3'e yuklenir ve CloudFront uzerinden guvenli bir sekilde izlenir. Personel videolari ileri saramaaz; bu sayede icerigin tamamen izlenmesi garanti altina alinir.

**Adim 3 - Sinav Sorulari:** Egitim oncesi (on-sinav) ve egitim sonrasi (son-sinav) sorularini ekleyin. Soru bankasi bolumunden mevcut sorulari secerek veya yeni sorular olusturarak sinav icerigini hazirlayin. Gecme notu, soru sayisi ve sinav suresi gibi ayarlari bu adimda yapin.

**Adim 4 - Atama:** Egitimi hangi personele veya departmanlara atayacaginizi secin. Tum hastane personeline, belirli departmanlara veya tek tek kisilesere atama yapabilirsiniz. Son tarihi belirleyin ve kaydedin.

### Egitim Yayinlama ve Arsivleme

Olusturdugunuz egitim varsayilan olarak "Taslak" durumundadir. Iceriginden emin oldugunuzda "Yayinla" butonuna tiklayarak egitimi aktif hale getirin. Yayinlanan egitim, atanan personelin panelinde gorunur hale gelir. Suresi dolan veya artik gerekli olmayan egitimleri "Arsivle" butonu ile arsive kaldirabilirsiniz. Arsivlenen egitimler personel panelinden kalkar ancak raporlarda goruntulenmleye devam eder.

### Egitim Kopyalama

Mevcut bir egitimi temel alarak yeni bir egitim olusturmak istediginizde "Kopyala" ozelligini kullanabilirsiniz. Bu islem egitimin tum icerigini (videolar, sorular, ayarlar) yeni bir taslak olarak kopyalar. Kopyalanan egitim uzerinde degisiklik yaparak zaman kazanabilirsiniz.

### Zorunlu Egitimler

Zorunlu olarak isaretlenen egitimler personel panelinde ozel bir etiketle vurgulanir. Bu egitimlerin son tarihine yaklasildikca sistem otomatik hatirlatma bildirimleri gonderir. Zorunlu egitimleri tamamlamayan personel raporlarda ayrica listelenir ve yoneticiye uyari gonderilir.

---

## 5. Sinav Sistemi

### Sinav Ayarlari

Her egitimin on-sinav ve son-sinav bolumu bulunur. Sinav ayarlarinda su parametreleri belirleyebilirsiniz: sinav suresi (dakika), gecme notu (yuzde), toplam soru sayisi, deneme hakki (kac kez tekrar girebilecegi) ve sorularin karistirilip karistirilmayacagi. Bu ayarlar egitim olusturma sihirbazinin ucuncu adiminda yapilir.

### Soru Tipleri

Sistem dort farkli soru tipini destekler: Coktan secmeli (tek dogru), coktan secmeli (cok dogru), dogru-yanlis ve acik uclu sorular. Her soru icin aciklama metni ve dogru cevap gosterim secenegi tanimlanabilir. Sorulara gorsel ekleme imkani da mevcuttur.

### Soru Bankasi

"Soru Bankasi" bolumunden daha once olusturdugunuz tum sorulari gorebilir ve yonetebilirsiniz. Sorulari kategoriye, zorluk derecesine ve soru tipine gore filtreleyebilirsiniz. Soru bankasindaki sorulari birden fazla egitimde kullanabilirsiniz. Yeni soru eklerken kategori ve zorluk derecesi belirlemek, ileride soru secimini kolaylastirir.

### Sinav Sonuclari

Sinav sonuclari hem egitim detay sayfasindan hem de "Raporlar" bolumunden incelenebilir. Her sinav girisimi icin personelin verdigi cevaplar, dogru/yanlis dagilimi, gecirdigi sure ve aldigi puan goruntulenir. Basarisiz olan personele sistem otomatik olarak yeni deneme hakki tanimlar (ayarlarda belirlenen limite kadar). Tum sinav sonuclarini Excel veya PDF olarak disari aktarabilirsiniz.

---

## 6. Sertifika Yonetimi

### Otomatik Sertifika Olusturma

Personel bir egitimi basariyla tamamladiginda (son sinavi gecme notuyla gectiginde) sistem otomatik olarak bir sertifika olusturur. Sertifika uzerinde personelin adi, egitimin adi, tamamlama tarihi, gecerlilik suresi ve benzersiz bir dogrulama kodu (QR kod dahil) yer alir.

### Sertifika Dogrulama

Her sertifika uzerinde yer alan QR kod veya dogrulama kodu ile sertifikanin gercekligi kontrol edilebilir. Dogrulama sayfasi herkese aciktir; dis denetciler veya ucuncu taraflar bu sayfa uzerinden sertifikanin gecerliligini teyit edebilir. Gecerliligi sona ermis veya iptal edilmis sertifikalar dogrulama sirasinda uyari mesaji gosterir.

### PDF Indirme

Personel kendi panelinden, yonetici ise sertifika yonetim ekranindan sertifikalari PDF formatinda indirebilir. PDF sertifikalar Turkce karakter destegi ile olusturulur ve hastanenizin logosu ile markalamasi icerir. Toplu sertifika indirme secenegi ile bir egitimi tamamlayan tum personelin sertifikalarini tek seferde indirebilirsiniz.

### Sertifika Takibi

Sertifika yonetim ekraninda tum sertifikalarin listesini gorebilir, gecerliligi yaklasan sertifikalari filtreleyebilir ve gerektiginde sertifika iptal islemlerini gerceklestirebilirsiniz. Gecerliligi dolmak uzere olan sertifikalar icin sistem hem personele hem yoneticiye otomatik hatirlatma gonderir.

---

## 7. Raporlama

### Egitim Raporlari

Raporlar bolumunden "Egitim Raporlari" sekmesine tiklayarak egitim bazli detayli analizlere ulasin. Bu rapor her egitim icin atanan personel sayisi, tamamlama orani, ortalama basari puani ve tamamlama suresi gibi metrikleri gosterir. Raporlari tarih araligina ve egitim kategorisine gore filtreleyebilirsiniz.

### Personel Performansi

"Personel Performansi" sekmesinde her personelin egitim gecmisini, tamamladigi egitim sayisini, ortalama sinav puanini ve sertifika durumunu gorebilirsiniz. Bu rapor ozellikle bireysel performans degerlendirmelerinde ve kariyer gelisim planlamalarinda faydalidir. Personelleri basari durumuna gore siralayabilir ve filtreleyebilirsiniz.

### Departman Analizi

"Departman Analizi" sekmesi her departmanin egitim tamamlama oranini, ortalama basari puanini ve zorunlu egitim uyum durumunu karsilastirmali olarak gosterir. Bu rapor departmanlar arasi farkliliklari hizlica gormenizi saglar ve dusuk performans gosteren departmanlara yonelik aksiyon almaniza yardimci olur.

### Disari Aktarma (Export)

Tum raporlar Excel ve PDF formatlarinda disari aktarilabilir. Rapor sayfasinin sag ust kosesindeki "Excel'e Aktar" veya "PDF Olustur" butonlarini kullanarak verileri indirebilirsiniz. Excel dosyalari detayli veri analizi icin, PDF dosyalari ise sunumlarda ve resmi raporlamada kullanilmak uzere formatlanmistir. Turkce karakter destegi her iki formatta da eksiksiz olarak saglanmaktadir.

### Zamanlanmis Raporlar

Belirli raporlari haftalik veya aylik olarak otomatik olusturulup e-posta ile gonderilecek sekilde zamanlayabilirsiniz. Bu ozellik ozellikle ust yonetime duzenli rapor sunmak icin kullanislidir.

---

## 8. Bildirimler

### Bildirim Gonderme

Sol menuden "Bildirimler" bolumune giderek personele bildirim gonderebilirsiniz. Bildirim olusturma ekraninda alici olarak tek bir personel, bir departman veya tum personeli secebilirsiniz. Bildirim basligini ve icerigini yazarak gonderin. Bildirimler personelin panelinde anlik olarak gorunur (Supabase Realtime altyapisi ile).

### Otomatik Hatirlatmalar

Sistem asagidaki durumlarda otomatik bildirim gonderir: egitim son tarihi yaklastiginda (7 gun ve 1 gun oncesinde), zorunlu egitim atandiginda, sinav sonucu aciklandiginda ve sertifika olusturuldugunda. Otomatik hatirlatmalar her gun sabah 07:00'de cron gorevi ile kontrol edilir ve tetiklenir.

### E-posta Bildirimleri

Onemli bildirimler ayni zamanda personelin kayitli e-posta adresine de gonderilir. E-posta bildirimleri Turkce olarak hazirlanmis sablonlar ile gonderilir. Ayarlar bolumunden hangi bildirimlerin e-posta olarak da gonderilecegini yapilandirabilirsiniz. E-posta gonderimi SMTP altyapisi uzerinden calismaktadir.

### Bildirim Gecmisi

Gonderilen tum bildirimlerin gecmisine "Bildirimler" sayfasindan ulasabilirsiniz. Her bildirim icin gonderim zamani, alici sayisi, okunma orani ve gonderim durumu (basarili/basarisiz) bilgileri yer alir.

---

## 9. Ayarlar

### Hastane Bilgileri

Ayarlar bolumunun ilk sekmesinde hastanenizin temel bilgilerini yonetebilirsiniz: hastane adi, adresi, telefon numarasi, e-posta adresi ve logo. Bu bilgiler sertifikalarda, e-postalarda ve raporlarda kullanilir. Logoyu degistirmek icin "Logo Yukle" butonunu kullanin; onerilen boyut 200x200 pikseldir.

### Egitim Varsayilanlari

Bu sekmede yeni egitim olustururken varsayilan olarak kullanilacak degerleri belirleyin: varsayilan sinav suresi, gecme notu, deneme hakki sayisi ve egitim gecerlilik suresi. Bu degerler her egitim icin ayri ayri degistirilebilir ancak varsayilanlari dogru belirlemek zaman kazandirir.

### Bildirim Ayarlari

Hangi olaylarda otomatik bildirim ve e-posta gonderilecegini bu sekmeden yapilandirin. Ornegin egitim atandiginda, sinav sonucu aciklandiginda veya sertifika olusturuldugunda bildirim gonderimini acip kapatabilirsiniz. Hatirlatma gunlerini (kac gun once hatirlatma yapilacagi) ayarlayabilirsiniz.

### Guvenlik Ayarlari

Guvenlik sekmesinde oturum zaman asimi suresini (varsayilan 30 dakika), sifre politikasini ve iki faktorlu dogrulama gereksinimini ayarlayabilirsiniz. Oturum zaman asimi, personelin belirli bir sure islem yapmamasi durumunda otomatik cikis yapmasini saglar. Bu sure kurumunuzun guvenlik politikasina gore ayarlanmalidir.

### HIS Entegrasyonu

Hastane Bilgi Sistemi (HIS) entegrasyonu sekmesinden hastanenizin mevcut HIS sistemi ile veri senkronizasyonu ayarlarini yapabilirsiniz. Entegrasyon aktif edildiginde personel bilgileri HIS'ten otomatik olarak senkronize edilir. Senkronizasyon her gun 04:00'te otomatik calisan bir gorev ile gerceklestirilir.

### Markalama

Markalama sekmesinden sisteminizin gorunumunu ozellestirebilirsiniz. Hastanenizin logosunu, renk temasini ve giris sayfasi mesajini ayarlayabilirsiniz. Bu ayarlar personelin sisteme giris yaptiginda gorecegi tum sayfalara yansir.

---

## 10. Sikca Sorulan Sorular

### S: Sifremi unuttum, ne yapmaliyim?

C: Giris ekranindaki "Sifremi Unuttum" baglantisinasina tiklayin ve kayitli e-posta adresinizi girin. Sistem size sifre sifirlama baglantisi icereen bir e-posta gonderecektir. E-posta gelmezse spam/gereksiz klasorunuzu kontrol edin. Sorun devam ederse Super Admin ile iletisime gecin.

### S: Personel toplu aktarim dosyasi hangi formatta olmali?

C: Toplu aktarim icin Excel (.xlsx) formati kullanilmalidir. "Toplu Aktar" butonuna tikladiginizda ornek sablonu indirebilirsiniz. Sablon icindeki sutun basliklarini degistirmeyin; sadece verileri girin. Her satirda en az ad-soyad, e-posta ve departman bilgisi zorunludur.

### S: Bir egitimi yayinladiktan sonra icerigini degistirebilir miyim?

C: Yayindaki bir egitimin temel bilgilerini (ad, aciklama, tarih) duzenleyebilirsiniz. Ancak video ve sinav iceriginde buyuk degisiklik yapmaniz gerekiyorsa egitimi arsivleyip "Kopyala" ozelligi ile yeni bir taslak olusturmaniz onerilir. Bu sayede mevcut personelin tamamlama kayitlari bozulmaz.

### S: Sinav sirasinda internet baglantisi kesilirse ne olur?

C: Sinav sistemi periyodik olarak cevaplari sunucuya kaydeder. Baglanti kesildiginde personel tekrar baglandiginda kaldigi yerden devam edebilir. Sinav suresi sunucu tarafinda (Redis) tutuldugu icin baglanti kesintisi sure manipulasyonuna izin vermez.

### S: Personel videoyu ileri sarabilir mi?

C: Hayir. Egitim videolarinda ileri sarma ozelligi kasitli olarak devre disi birakilmistir. Bu sayede personelin video icerigini tamamen izlemesi garanti altina alinir. Personel videoyu duraklatabilir ve geri sarabilir ancak izlemedigi bir bolume atlayamaz.

### S: Sertifikalarin gecerlilik suresi var mi?

C: Evet. Her egitim icin bir gecerlilik suresi belirlenir (ornegin 1 yil). Bu surenin sonunda sertifika gecersiz olarak isaretlenir ve personelin egitimi yenilemesi gerekir. Gecerlilik suresi dolmadan once hem personele hem yoneticiye hatirlatma bildirimi gonderilir.

### S: Raporlari otomatik olarak e-posta ile alabilir miyim?

C: Evet. Raporlar bolumunde ilgili raporun ayarlarindan zamanlanmis rapor olusturabilirsiniz. Haftalik veya aylik periyotlarla raporun otomatik olusturulup belirlediginiz e-posta adresine gonderilmesini saglayabilirsiniz.

### S: Farkli departmanlara farkli egitimler atayabilir miyim?

C: Evet. Egitim olusturma sihirbazinin son adiminda (Atama) hedef olarak belirli departmanlari secebilirsiniz. Ayrica ayni egitimi birden fazla departmana veya tek tek personele de atayabilirsiniz. Departman bazli atama, o departmana yeni eklenen personeli otomatik olarak kapsamaz; yeni personel icin atamayi ayrica yapmaniz gerekir.

### S: Sistemde kac yonetici hesabi olabilir?

C: Her hastane icin birden fazla yonetici hesabi olusturulabilir. Ancak yonetici hesabi yalnizca Super Admin tarafindan tanimlanabilir. Tum yonetici hesaplari esit yetkiye sahiptir ve birbirlerinin islemlerini gorebilir.

### S: Verilerimiz guvende mi?

C: Evet. Tum veriler Supabase uzerinde PostgreSQL veritabaninda sifrelenmis baglanti ile saklanir. Row Level Security (RLS) politikalari sayesinde her hastane yalnizca kendi verilerine erisebilir; farkli hastanelerin verileri birbirinden tamamen izoledir. Video icerikleri AWS S3 uzerinde saklanir ve imzali URL'ler ile erisim saglannir. Gunluk otomatik yedekleme sistemi ile veri kaybi riski en aza indirilmistir.

---

> Bu kilavuz Hastane LMS v0.1.0 icin hazirlanmistir. Sorulariniz icin destek e-posta adresine basvurabilirsiniz.
