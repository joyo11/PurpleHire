// Mohammad Shafay Joyo @ 2025

// Import required components and Next.js utilities
import ChatInterface from "@/components/ChatInterface"
import Head from "next/head"

// Main home page component
export default function Home() {
  return (
    <>
      {/* Head section for metadata and favicon */}
      <Head>
        <title>PurpleHire</title>
        <meta name="description" content="An AI-powered chat interface" />
        <link rel="icon" href="/PurpleHire.png" />
      </Head>

      {/* Main container with chat interface */}
      <main className="min-h-screen bg-black">
        <ChatInterface />
      </main>
    </>
  )
}

