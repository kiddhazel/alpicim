import { describe, expect, it } from 'vitest';
import { categorize, sortCategories } from './categorize';

describe('categorize', () => {
  it('Steam/Epic kısayollarını ve oyun klasörlerini oyun sayar', () => {
    expect(categorize({ name: 'Counter-Strike 2', target: 'steam://rungameid/730' })).toBe('Oyun');
    expect(categorize({ name: 'Bir Oyun', target: 'com.epicgames.launcher://apps/x?action=launch' })).toBe('Oyun');
    expect(categorize({ name: 'Bilinmeyen', target: 'D:\\steam\\steamapps\\common\\X\\x.exe' })).toBe('Oyun');
    expect(categorize({ name: 'Escape from Tarkov', target: 'C:\\Battlestate Games\\BsgLauncher\\BsgLauncher.exe' })).toBe('Oyun');
  });

  it('bilinen uygulamaları doğru kategoriye koyar', () => {
    expect(categorize({ name: 'Discord', target: 'C:\\Users\\x\\AppData\\Local\\Discord\\Update.exe' })).toBe('İletişim');
    expect(categorize({ name: 'Google Chrome', target: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })).toBe('İnternet');
    expect(categorize({ name: 'Word', target: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE' })).toBe('Üretkenlik');
    expect(categorize({ name: 'Visual Studio Code', target: 'C:\\x\\Code.exe' })).toBe('Geliştirme');
    expect(categorize({ name: 'OBS Studio', target: 'C:\\obs\\obs64.exe' })).toBe('Medya ve Tasarım');
    expect(categorize({ name: 'Remote Desktop Connection', target: 'C:\\WINDOWS\\system32\\mstsc.exe' })).toBe('Sistem ve Araçlar');
    expect(categorize({ name: 'NVIDIA App', target: 'C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\x.exe' })).toBe('Sistem ve Araçlar');
  });

  it('kelime sınırına dikkat eder (ör. "Barcode" geliştirme değildir)', () => {
    expect(categorize({ name: 'Barcode Studio', target: 'C:\\b\\bc.exe' })).toBe('Diğer');
  });

  it('Başlat menüsü klasörünü ipucu olarak kullanır', () => {
    expect(categorize({ name: 'Yardımcı', target: 'C:\\x\\y.exe', folder: 'Steam' })).toBe('Oyun');
  });
});

describe('sortCategories', () => {
  it('sabit sırayı korur, özel kategorileri araya, Diğer ve kategorisizi sona koyar', () => {
    expect(sortCategories(['Diğer', 'Zeta', 'Oyun', '', 'İletişim', 'Alfa'])).toEqual(['Oyun', 'İletişim', 'Alfa', 'Zeta', 'Diğer', '']);
  });
});
