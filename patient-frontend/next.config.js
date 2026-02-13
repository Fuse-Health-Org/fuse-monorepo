/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fusehealthbucket-staging.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fusehealthbucket-staging.s3.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    // Exclude the Fuse Patient Portal UI folder from compilation
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /Fuse Patient Portal UI/,
    });
    return config;
  },
  // Exclude the reference folder from file tracing
  outputFileTracingExcludes: {
    '*': ['./Fuse Patient Portal UI/**/*']
  }
}

module.exports = nextConfig