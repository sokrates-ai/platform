import { Sparkles } from 'lucide-react'
import React from 'react'

interface CourseCardProps {
  title: string
  description: string
  imageUrl?: string
  onClick: () => void
}

const CourseCard: React.FC<CourseCardProps> = ({
  title,
  description,
  imageUrl,
  onClick,
}) => {
  return (
    <div
      className="course-card border rounded-lg shadow-md overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="w-full h-40 object-cover" />
      ) : (
        <div className='h-40 flex justify-center items-center border-b-2 border-gray-200'>
        <Sparkles className='text-gray-500' size={50}/>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      </div>
    </div>
  )
}

export default CourseCard
