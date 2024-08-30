// app/page.tsx
import CheckInOutForm from "../components/checkinoutform";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-[20vh]">
      <CheckInOutForm />
    </main>
  );
}
