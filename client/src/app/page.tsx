"use client";

import { DEFAULT_MEMBER_ID } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const HomePage = () => {
  const memberId = DEFAULT_MEMBER_ID;
  const router = useRouter();

  useEffect(() => {
    if (!DEFAULT_MEMBER_ID) {
      console.error("Member id is missing");
      return;
    }

    router.push("/contacts");
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Authenticating...</h1>
        <p>Connecting to Bitrix24 and redirecting you shortly.</p>
      </div>
    </div>
  );
};

export default HomePage;
