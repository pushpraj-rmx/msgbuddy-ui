This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

This is a pure client-side Next.js app that connects directly to the MsgBuddy backend API.

### API URL Configuration

The app connects to the MsgBuddy API. By default, it uses `https://v2.msgbuddy.com`.

To configure a different API URL, create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_API_URL=https://v2.msgbuddy.com
```

## Authentication

- Access tokens are short-lived (≈15 minutes) and kept in memory/localStorage plus a non-HttpOnly cookie for SSR usage.
- Refresh tokens are stored as HttpOnly cookies set during login/register; they rotate on refresh.
- Axios silently refreshes on `401` responses. If refresh fails, the session is cleared and the user is sent to `/login`.
- Logout calls the API to revoke the refresh token and removes local cookies.

## Getting Started

First, make sure your MsgBuddy API is reachable at `https://v2.msgbuddy.com` (or configure the URL as shown above).

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# msgbuddy-ui
# msgbuddy-ui
