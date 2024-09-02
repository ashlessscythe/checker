// components/NotAuthorizedPage.tsx
import Link from 'next/link';

export default function NotAuthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">Access Denied</h1>
      <p className="text-2xl text-gray-600 mb-8">"Ah ah ah! You didn't say the magic word!"</p>
      <div className="mb-8">
        <img src="/dinosaur.gif" alt="Dinosaur saying no" className="rounded-lg shadow-lg" />
      </div>
      <Link href="/">
        <a className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
          Go back and find the magic word
        </a>
      </Link>
    </div>
  );
}