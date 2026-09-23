/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export: `npm run build` writes plain files to dist/.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
