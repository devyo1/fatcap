import { redirect } from 'next/navigation';

// No public member list: find people through search.
export default function Members() {
  redirect('/search');
}
