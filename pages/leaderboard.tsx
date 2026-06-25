import type { GetServerSideProps } from 'next';

// The leaderboard lives on the (renamed) "/picks" page now. Redirect any old
// links here so there's a single standings view.
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/picks', permanent: false },
});

export default function LeaderboardRedirect() {
  return null;
}
