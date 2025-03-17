"use client"
import { motion } from "framer-motion"
import Image from "next/image"
import logo_black from "@public/black_logo.svg"

const variants = {
  hidden: { opacity: 0, scale: 0.9 },
  enter: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
}

const logoVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.8, 1, 0.8],
    transition: {
      duration: 2,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  },
}

function PageLoading() {
  return (
    <motion.main
      variants={variants}
      initial="hidden"
      animate="enter"
      exit="exit"
      transition={{ type: "ease-in-out", duration: 0.5 }}
      className="flex items-center justify-center min-h-screen w-full"
    >
      <div className="flex flex-col items-center justify-center">
        <motion.div variants={logoVariants} animate="animate" className="flex justify-center">
          <Image
            width={440}
            height={440}
            className="mx-auto opacity-25"
            src={logo_black || "/placeholder.svg"}
            alt="HPI Sokrates"
            priority
          />
        </motion.div>
      </div>
    </motion.main>
  )
}

export default PageLoading

