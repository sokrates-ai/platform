import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <>
      <div className="relative w-full min-h-screen bg-white overflow-hidden bg-[url('/background-1.svg')] bg-repeat bg-auto">
        <div className="absolute inset-0 pointer-events-none bg-white/80" />

        <Link href="/" className="z-20 pointer-events-auto absolute top-6 left-1/2 transform -translate-x-1/2 sm:transform-none sm:translate-x-0 sm:top-8 sm:left-10">
          <Image
            src="/dark_logo.svg"
            alt="Sokrates Logo"
            width={157}
            height={27}
            className="w-[130px] sm:w-[157px] h-auto cursor-pointer"
          />
        </Link>

        <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-32 pb-16 text-center relative z-10">
          <h1
            className="font-black text-[#F4F4F4] leading-tight m-0 p-0"
            style={{
              textShadow: '0px clamp(6px, 0.5vw, 8px) 0px #454545',
              WebkitTextStrokeWidth: 'clamp(2px, 0.5vw, 4px)',
              WebkitTextStrokeColor: '#626262',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 'clamp(10rem, 20vw, 16.25rem)',
              letterSpacing: 'clamp(0.1rem, 0.3vw, 0.245rem)',
            }}
          >
            404
          </h1>

          <p className="-mt-6 max-w-[95%] sm:max-w-[80%] md:max-w-[600px] text-gray-600 font-medium leading-tight tracking-wider p-0 text-2xl sm:text-2xl md:text-2xl font-['DM_Sans']">
            The page you are looking for can't be found.
          </p>

          <div className="mt-20 w-[180px] sm:w-[200px] md:w-[215px]">
            <img
              src="/looking-at-sheet.svg"
              alt="Sokrates Mascot"
              className="w-full h-auto mx-auto max-w-full"
            />
          </div>
        </div>
      </div>
    </>
  )
}
