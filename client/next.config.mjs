/** @type {import('next').NextConfig} */
const getBackendDestination = () => {
  const backend = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!backend) return 'http://localhost:4000/api/:path*';
  const trimmed = backend.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? `${trimmed}/:path*` : `${trimmed}/api/:path*`;
};

const getBackendRootHealth = () => {
  const backend = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!backend) return 'http://localhost:4000/health';
  const trimmed = backend.replace(/\/+$/, '');
  const root = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  return `${root}/health`;
};

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: getBackendDestination(),
      },
      {
        source: '/health',
        destination: getBackendRootHealth(),
      },
    ];
  },
};

export default nextConfig;
