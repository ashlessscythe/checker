import { tx, id } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import { performCheckinOut, CheckActionType } from "./checkInOut";

const SAMPLE_NAMES = [
  "John Smith",
  "Emma Wilson",
  "Michael Brown",
  "Sarah Davis",
  "James Johnson",
  "Lisa Anderson",
  "David Miller",
  "Jennifer Taylor",
  "Robert White",
  "Maria Garcia",
];

export const EMAIL_DOMAINS = [
  "example.com",
  "test.com",
  "demo.org",
  "sample.net",
];

interface TestUser {
  id: string;
  name: string;
  email: string;
  punches: any[];
}

// Generate a random time between 7 AM and 10 AM (in milliseconds)
const getRandomMorningTime = (baseDate: Date) => {
  const hour = 7 + Math.floor(Math.random() * 3); // Random hour between 7-9
  const minute = Math.floor(Math.random() * 60);
  return new Date(baseDate).setHours(hour, minute, 0, 0);
};

// Generate a random time between 3 PM and 7 PM (in milliseconds)
const getRandomEveningTime = (baseDate: Date) => {
  const hour = 15 + Math.floor(Math.random() * 4); // Random hour between 15-18
  const minute = Math.floor(Math.random() * 60);
  return new Date(baseDate).setHours(hour, minute, 0, 0);
};

// Create a new test user
const createTestUser = async () => {
  const userId = id();
  const nameIndex = Math.floor(Math.random() * SAMPLE_NAMES.length);
  const name = SAMPLE_NAMES[nameIndex];
  const email = `${name.toLowerCase().replace(" ", ".")}@${
    EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)]
  }`;

  await db.transact([
    tx.users[userId].update({
      name,
      email,
      isActive: true,
    }),
  ]);

  return {
    id: userId,
    name,
    email,
    punches: [],
  };
};

// Generate punches for a single day
const generatePunchesForDay = async (user: TestUser, date: Date) => {
  // 90% chance of having punches for a weekday
  if (
    date.getDay() !== 0 &&
    date.getDay() !== 6 && // Not weekend
    Math.random() < 0.9
  ) {
    // Morning check-in
    const morningTime = getRandomMorningTime(date);
    await performCheckinOut(user, CheckActionType.SystemCheckIn);

    // Simulate time passing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Evening check-out (with some variations)
    const eveningTime = getRandomEveningTime(date);
    const randomScenario = Math.random();

    // System checkout
    await performCheckinOut(user, CheckActionType.SystemCheckOut);
  }
};

// Generate test data for multiple users over a date range
export const generateTestData = async (
  numUsers: number,
  startDate: Date,
  endDate: Date
) => {
  const users: TestUser[] = [];

  // Create users
  for (let i = 0; i < numUsers; i++) {
    const user = await createTestUser();
    users.push(user);
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between users
  }

  // Generate punches for each day in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    for (const user of users) {
      await generatePunchesForDay(user, new Date(currentDate));
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between days
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return users;
};

// Helper function to generate test data for the last N days
export const generateRecentTestData = async (
  numUsers: number,
  numDays: number
) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - numDays);

  return generateTestData(numUsers, startDate, endDate);
};
