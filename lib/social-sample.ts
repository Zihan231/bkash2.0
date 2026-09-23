// Demo-only: fills the local store with a few fake submissions so the admin
// dashboard has something to show before anyone uses the /social form.
import { COLLEGES } from '@/lib/social-campaign';
import { addSubmission } from '@/lib/social-store';

const NAMES = ['Nusrat Jahan', 'Tanvir Ahmed', 'Farhana Akter', 'Rafiul Islam', 'Sadia Rahman', 'Mahmudul Hasan'];

function randomPhone() {
  const prefix = ['013', '014', '015', '016', '017', '018', '019'][Math.floor(Math.random() * 7)];
  return prefix + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
}

function placeholderScreenshot(name: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 540, 960);
    gradient.addColorStop(0, '#e2136e');
    gradient.addColorStop(1, '#8b124c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 540, 960);
    ctx.fillStyle = '#fff';
    ctx.fillRect(60, 200, 420, 420);
    ctx.fillStyle = '#e2136e';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('#day1withbKash', 270, 420);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.fillText(name, 270, 700);
    ctx.font = '22px sans-serif';
    ctx.fillText('Sample screenshot', 270, 745);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create sample image.'))), 'image/png'),
  );
}

export async function addSampleSubmissions(count = 6) {
  for (let i = 0; i < count; i++) {
    const name = NAMES[i % NAMES.length];
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 3 * 24 * 60) * 60_000);
    await addSubmission(
      {
        name,
        college: COLLEGES[Math.floor(Math.random() * COLLEGES.length)],
        contactNumber: randomPhone(),
        bkashNumber: randomPhone(),
        friendBkashNumber: randomPhone(),
        screenshot: await placeholderScreenshot(name),
        screenshotName: `screenshot_${i + 1}.png`,
      },
      createdAt,
    );
  }
}
