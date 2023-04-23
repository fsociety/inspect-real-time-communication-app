import Head from 'next/head';
import crypto from 'crypto';

export default function Home({roomId}) {
  return (
    <div className='w-full h-screen'>
      <Head>
        <title>Inspect - Real Time Communication</title>
        <meta name="description" content="Real time communication app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

    <div className="h-full bg-gray-900">
      <main className='grid items-center h-full px-6 lg:px-8'>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-center sm:text-7xl">
            INSPECT
          </h1>
          <h2 className='mt-3 text-4xl font-bold tracking-tight text-transparent sm:text-center sm:text-6xl bg-clip-text bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 "'>
            A REAL TIME COMMUNICATION
            <span className='block'>APPLICATION</span>
          </h2>
          <div className="flex flex-col items-center gap-4 mt-8 sm:justify-center">
            <a
              href={`/${roomId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 text-2xl font-semibold leading-7 text-white rounded-lg shadow-sm bg-gradient-to-r from-cyan-500 to-blue-500 ring-1"
            >
              Get started
              <span className="text-indigo-200" aria-hidden="true"> &rarr; </span>
            </a>
          </div>
        </div>
      </main>
    </div>

    </div>
  )
}

export async function getServerSideProps(){
  const buf = crypto.randomBytes(8).toString("hex");
  const roomId = parseInt(buf,16).toString().substring(0,16);

  return { props: { roomId } }
}