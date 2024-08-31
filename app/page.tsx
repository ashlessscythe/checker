// app/page.tsx
import CheckInOutForm from "../components/checkinoutform";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-[10vh]">
      <CheckInOutForm />
      <div className="mt-8 flex item-center space-x-4">
        <Link
          href="/check-ins"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          View Last 24 Hours Swipes
        </Link>
        <Link
          href="/checklist"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Checklist
        </Link>
      </div>
    </main>
  );
}
