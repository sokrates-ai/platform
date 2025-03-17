import { getUriWithOrg } from '@services/config/config'
import { BookCopy } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

function MenuLinks({ orgslug }: { orgslug: string }) {
  return (
    <div className='pl-1'>
      <ul className="flex space-x-5">
        {/* <LinkItem link="/courses" type="courses" orgslug={orgslug} /> */}
      </ul>
    </div>
  )
}

const LinkItem = ({ link, orgslug, type }: { link: string; orgslug: string; type: string }) => {
  return (
    <div></div>
    // <Link href={getUriWithOrg(orgslug, link)}>
    //   <li className="flex space-x-2 items-center text-[#909192] font-medium">
    //     {type === 'courses' && (
    //       <>
    //         <BookCopy size={20} />
    //         <span>Courses</span>
    //       </>
    //     )}
    //   </li>
    // </Link>
  )
}

export default MenuLinks