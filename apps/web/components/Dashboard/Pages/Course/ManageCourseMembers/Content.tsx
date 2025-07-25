'use client'

import { useState } from 'react'
import {
  Search,
  Users,
  User,
  BookOpen,
  Smile,
  BarChart3,
  NotebookPen,
  Backpack,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart'
import {
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ComposedChart,
  Area,
  CartesianGrid,
} from 'recharts'

// Classroom performance data
const classroomPerformance = [
  { week: 1, score: 72 },
  { week: 2, score: 74 },
  { week: 3, score: 71 },
  { week: 4, score: 76 },
  { week: 5, score: 78 },
  { week: 6, score: 75 },
  { week: 7, score: 79 },
  { week: 8, score: 77 },
]

// Mock student data with performance history
const students = [
  {
    id: 1,
    name: 'Clarissa Charlson',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female0.png',
    exercises: 13,
    homework: 2,
    satisfaction: 68,
    performance: 63,
    performanceHistory: [
      { week: 1, score: 58 },
      { week: 2, score: 62 },
      { week: 3, score: 59 },
      { week: 4, score: 64 },
      { week: 5, score: 66 },
      { week: 6, score: 63 },
      { week: 7, score: 67 },
      { week: 8, score: 65 },
    ],
    exerciseHistory: [
      { name: 'Algebra Basics', passed: true },
      { name: 'Quadratic Equations', passed: false },
      { name: 'Linear Functions', passed: true },
      { name: 'Polynomial Division', passed: false },
      { name: 'Factoring', passed: true },
      { name: 'Systems of Equations', passed: false },
      { name: 'Inequalities', passed: true },
      { name: 'Graphing', passed: false },
      { name: 'Word Problems', passed: true },
      { name: 'Review Quiz', passed: false },
    ],
  },
  {
    id: 2,
    name: 'Tyron Franzke',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male0.png',
    exercises: 8,
    homework: 3,
    satisfaction: 72,
    performance: 82,
    performanceHistory: [
      { week: 1, score: 75 },
      { week: 2, score: 78 },
      { week: 3, score: 80 },
      { week: 4, score: 79 },
      { week: 5, score: 82 },
      { week: 6, score: 84 },
      { week: 7, score: 81 },
      { week: 8, score: 82 },
    ],
    exerciseHistory: [
      { name: 'Solve for X', passed: true },
      { name: 'Solve for X', passed: false },
      { name: 'Circle Theorems', passed: false },
      { name: 'Area Calculations', passed: true },
      { name: 'Volume Problems', passed: true },
      { name: 'Coordinate Geometry', passed: true },
      { name: 'Transformations', passed: false },
      { name: 'Similarity', passed: true },
      { name: 'Trigonometry Basics', passed: true },
      { name: 'Practice Test', passed: true },
    ],
  },
  {
    id: 3,
    name: 'Emma Wilson',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female1.png',
    exercises: 15,
    homework: 1,
    satisfaction: 85,
    performance: 91,
    performanceHistory: [
      { week: 1, score: 85 },
      { week: 2, score: 87 },
      { week: 3, score: 89 },
      { week: 4, score: 88 },
      { week: 5, score: 90 },
      { week: 6, score: 92 },
      { week: 7, score: 91 },
      { week: 8, score: 91 },
    ],
    exerciseHistory: [
      { name: 'Calculus Limits', passed: true },
      { name: 'Derivatives', passed: true },
      { name: 'Chain Rule', passed: true },
      { name: 'Integration', passed: true },
      { name: 'Applications', passed: true },
      { name: 'Related Rates', passed: true },
      { name: 'Optimization', passed: true },
      { name: 'Area Under Curve', passed: true },
      { name: 'Advanced Problems', passed: false },
      { name: 'Final Assessment', passed: true },
    ],
  },
  {
    id: 4,
    name: 'Michael Brown',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male1.png',
    exercises: 6,
    homework: 4,
    satisfaction: 58,
    performance: 67,
    performanceHistory: [
      { week: 1, score: 60 },
      { week: 2, score: 62 },
      { week: 3, score: 65 },
      { week: 4, score: 63 },
      { week: 5, score: 67 },
      { week: 6, score: 69 },
      { week: 7, score: 66 },
      { week: 8, score: 67 },
    ],
    exerciseHistory: [
      { name: 'Basic Equations', passed: true },
      { name: 'Fractions', passed: false },
      { name: 'Decimals', passed: true },
      { name: 'Percentages', passed: false },
      { name: 'Ratios', passed: true },
      { name: 'Proportions', passed: false },
      { name: 'Simple Interest', passed: true },
      { name: 'Compound Interest', passed: false },
      { name: 'Measurement', passed: true },
      { name: 'Data Analysis', passed: false },
    ],
  },
  {
    id: 5,
    name: 'Sarah Davis',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female0.png',
    exercises: 12,
    homework: 2,
    satisfaction: 79,
    performance: 88,
    performanceHistory: [
      { week: 1, score: 80 },
      { week: 2, score: 83 },
      { week: 3, score: 85 },
      { week: 4, score: 87 },
      { week: 5, score: 88 },
      { week: 6, score: 86 },
      { week: 7, score: 89 },
      { week: 8, score: 88 },
    ],
    exerciseHistory: [
      { name: 'Trigonometry Identities', passed: true },
      { name: 'Unit Circle', passed: true },
      { name: 'Law of Sines', passed: true },
      { name: 'Law of Cosines', passed: true },
      { name: 'Trigonometric Equations', passed: false },
      { name: 'Inverse Functions', passed: true },
      { name: 'Graphing Trig Functions', passed: true },
      { name: 'Applications of Trig', passed: true },
      { name: 'Complex Numbers', passed: false },
      { name: 'Polar Coordinates', passed: true },
    ],
  },
  {
    id: 6,
    name: 'James Miller',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male0.png',
    exercises: 9,
    homework: 3,
    satisfaction: 65,
    performance: 73,
    performanceHistory: [
      { week: 1, score: 68 },
      { week: 2, score: 70 },
      { week: 3, score: 72 },
      { week: 4, score: 71 },
      { week: 5, score: 73 },
      { week: 6, score: 75 },
      { week: 7, score: 74 },
      { week: 8, score: 73 },
    ],
    exerciseHistory: [
      { name: 'Exponents and Radicals', passed: true },
      { name: 'Scientific Notation', passed: true },
      { name: 'Polynomial Operations', passed: false },
      { name: 'Rational Expressions', passed: true },
      { name: 'Solving Equations', passed: true },
      { name: 'Inequalities', passed: false },
      { name: 'Absolute Value', passed: true },
      { name: 'Complex Numbers', passed: true },
      { name: 'Logarithms', passed: false },
      { name: 'Sequences and Series', passed: true },
    ],
  },
  {
    id: 7,
    name: 'Olivia Garcia',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female1.png',
    exercises: 14,
    homework: 1,
    satisfaction: 82,
    performance: 89,
    performanceHistory: [
      { week: 1, score: 82 },
      { week: 2, score: 85 },
      { week: 3, score: 87 },
      { week: 4, score: 86 },
      { week: 5, score: 89 },
      { week: 6, score: 90 },
      { week: 7, score: 88 },
      { week: 8, score: 89 },
    ],
    exerciseHistory: [
      { name: 'Statistics Basics', passed: true },
      { name: 'Probability', passed: true },
      { name: 'Data Representation', passed: true },
      { name: 'Hypothesis Testing', passed: true },
      { name: 'Regression Analysis', passed: true },
      { name: 'Sampling Methods', passed: true },
      { name: 'Confidence Intervals', passed: true },
      { name: 'Variance and Standard Deviation', passed: true },
      { name: 'Correlation', passed: true },
      { name: 'Experimental Design', passed: true },
    ],
  },
  {
    id: 8,
    name: 'William Martinez',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male1.png',
    exercises: 7,
    homework: 5,
    satisfaction: 61,
    performance: 69,
    performanceHistory: [
      { week: 1, score: 62 },
      { week: 2, score: 65 },
      { week: 3, score: 67 },
      { week: 4, score: 66 },
      { week: 5, score: 69 },
      { week: 6, score: 71 },
      { week: 7, score: 68 },
      { week: 8, score: 69 },
    ],
    exerciseHistory: [
      { name: 'Basic Arithmetic', passed: true },
      { name: 'Number Systems', passed: false },
      { name: 'Order of Operations', passed: true },
      { name: 'Estimation', passed: false },
      { name: 'Problem Solving', passed: true },
      { name: 'Mental Math', passed: false },
      { name: 'Basic Algebra', passed: true },
      { name: 'Geometry Basics', passed: false },
      { name: 'Measurement', passed: true },
      { name: 'Data Interpretation', passed: false },
    ],
  },
  {
    id: 9,
    name: 'Sophia Anderson',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female0.png',
    exercises: 11,
    homework: 2,
    satisfaction: 76,
    performance: 84,
    performanceHistory: [
      { week: 1, score: 78 },
      { week: 2, score: 80 },
      { week: 3, score: 82 },
      { week: 4, score: 81 },
      { week: 5, score: 84 },
      { week: 6, score: 85 },
      { week: 7, score: 83 },
      { week: 8, score: 84 },
    ],
    exerciseHistory: [
      { name: 'Linear Equations', passed: true },
      { name: 'Graphing Lines', passed: true },
      { name: 'Slope and Intercept', passed: true },
      { name: 'Systems of Equations', passed: false },
      { name: 'Linear Inequalities', passed: true },
      { name: 'Absolute Value Equations', passed: true },
      { name: 'Functions', passed: true },
      { name: 'Domain and Range', passed: true },
      { name: 'Transformations', passed: false },
      { name: 'Applications', passed: true },
    ],
  },
  {
    id: 10,
    name: 'Benjamin Taylor',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male0.png',
    exercises: 10,
    homework: 3,
    satisfaction: 70,
    performance: 78,
    performanceHistory: [
      { week: 1, score: 72 },
      { week: 2, score: 74 },
      { week: 3, score: 76 },
      { week: 4, score: 75 },
      { week: 5, score: 78 },
      { week: 6, score: 79 },
      { week: 7, score: 77 },
      { week: 8, score: 78 },
    ],
    exerciseHistory: [
      { name: 'Polynomials', passed: true },
      { name: 'Factoring', passed: true },
      { name: 'Rational Expressions', passed: true },
      { name: 'Radicals', passed: false },
      { name: 'Quadratic Equations', passed: true },
      { name: 'Complex Numbers', passed: true },
      { name: 'Polynomial Functions', passed: true },
      { name: 'Graphing Polynomials', passed: true },
      { name: 'Applications', passed: false },
      { name: 'Review', passed: true },
    ],
  },
  {
    id: 11,
    name: 'Isabella Thomas',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female1.png',
    exercises: 13,
    homework: 1,
    satisfaction: 88,
    performance: 93,
    performanceHistory: [
      { week: 1, score: 88 },
      { week: 2, score: 90 },
      { week: 3, score: 92 },
      { week: 4, score: 91 },
      { week: 5, score: 93 },
      { week: 6, score: 94 },
      { week: 7, score: 92 },
      { week: 8, score: 93 },
    ],
    exerciseHistory: [
      { name: 'Exponential Functions', passed: true },
      { name: 'Logarithmic Functions', passed: true },
      { name: 'Exponential Equations', passed: true },
      { name: 'Logarithmic Equations', passed: true },
      { name: 'Applications', passed: true },
      { name: 'Growth and Decay', passed: true },
      { name: 'Compound Interest', passed: true },
      { name: 'Graphing', passed: true },
      { name: 'Transformations', passed: true },
      { name: 'Review', passed: true },
    ],
  },
  {
    id: 12,
    name: 'Lucas Jackson',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male1.png',
    exercises: 5,
    homework: 6,
    satisfaction: 52,
    performance: 61,
    performanceHistory: [
      { week: 1, score: 55 },
      { week: 2, score: 58 },
      { week: 3, score: 60 },
      { week: 4, score: 59 },
      { week: 5, score: 61 },
      { week: 6, score: 63 },
      { week: 7, score: 60 },
      { week: 8, score: 61 },
    ],
    exerciseHistory: [
      { name: 'Basic Math', passed: false },
      { name: 'Addition', passed: true },
      { name: 'Subtraction', passed: false },
      { name: 'Multiplication', passed: true },
      { name: 'Division', passed: false },
      { name: 'Fractions', passed: false },
      { name: 'Decimals', passed: false },
      { name: 'Percentages', passed: true },
      { name: 'Ratios', passed: false },
      { name: 'Proportions', passed: false },
    ],
  },
  {
    id: 13,
    name: 'Mia White',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female0.png',
    exercises: 16,
    homework: 0,
    satisfaction: 91,
    performance: 96,
    performanceHistory: [
      { week: 1, score: 92 },
      { week: 2, score: 94 },
      { week: 3, score: 95 },
      { week: 4, score: 93 },
      { week: 5, score: 96 },
      { week: 6, score: 97 },
      { week: 7, score: 95 },
      { week: 8, score: 96 },
    ],
    exerciseHistory: [
      { name: 'Advanced Calculus', passed: true },
      { name: 'Multivariable Calculus', passed: true },
      { name: 'Differential Equations', passed: true },
      { name: 'Linear Algebra', passed: true },
      { name: 'Complex Analysis', passed: true },
      { name: 'Real Analysis', passed: true },
      { name: 'Topology', passed: true },
      { name: 'Abstract Algebra', passed: true },
      { name: 'Number Theory', passed: true },
      { name: 'Functional Analysis', passed: true },
    ],
  },
  {
    id: 14,
    name: 'Ethan Harris',
    age: 15,
    grade: '10th grade',
    avatar: '/students/male0.png',
    exercises: 8,
    homework: 4,
    satisfaction: 63,
    performance: 71,
    performanceHistory: [
      { week: 1, score: 65 },
      { week: 2, score: 68 },
      { week: 3, score: 70 },
      { week: 4, score: 69 },
      { week: 5, score: 71 },
      { week: 6, score: 73 },
      { week: 7, score: 70 },
      { week: 8, score: 71 },
    ],
    exerciseHistory: [
      { name: 'Geometry Basics', passed: true },
      { name: 'Angles', passed: true },
      { name: 'Triangles', passed: true },
      { name: 'Quadrilaterals', passed: false },
      { name: 'Circles', passed: true },
      { name: 'Area', passed: true },
      { name: 'Volume', passed: false },
      { name: 'Coordinate Geometry', passed: true },
      { name: 'Transformations', passed: false },
      { name: 'Review', passed: true },
    ],
  },
  {
    id: 15,
    name: 'Charlotte Clark',
    age: 16,
    grade: '10th grade',
    avatar: '/students/female1.png',
    exercises: 12,
    homework: 2,
    satisfaction: 80,
    performance: 86,
    performanceHistory: [
      { week: 1, score: 80 },
      { week: 2, score: 82 },
      { week: 3, score: 84 },
      { week: 4, score: 83 },
      { week: 5, score: 86 },
      { week: 6, score: 87 },
      { week: 7, score: 85 },
      { week: 8, score: 86 },
    ],
    exerciseHistory: [
      { name: 'Algebraic Expressions', passed: true },
      { name: 'Linear Equations', passed: true },
      { name: 'Quadratic Equations', passed: true },
      { name: 'Polynomials', passed: true },
      { name: 'Factoring', passed: true },
      { name: 'Rational Expressions', passed: false },
      { name: 'Radicals', passed: true },
      { name: 'Exponents', passed: true },
      { name: 'Logarithms', passed: false },
      { name: 'Review', passed: true },
    ],
  },
]

// Classroom layout - defines which students sit at which desks
const classroom = {
  desks: [
    // Row 1
    { id: 1, students: [1, 2], position: { row: 1, col: 1 } },
    { id: 2, students: [3, 4], position: { row: 1, col: 2 } },
    { id: 3, students: [5, 6], position: { row: 1, col: 3 } },
    // Row 2
    { id: 4, students: [7, 8], position: { row: 2, col: 1 } },
    { id: 5, students: [9, 10], position: { row: 2, col: 2 } },
    { id: 6, students: [11, 12], position: { row: 2, col: 3 } },
    // Row 3
    { id: 7, students: [13, 14], position: { row: 3, col: 1 } },
    { id: 8, students: [15, null], position: { row: 3, col: 2 } },
    { id: 9, students: [null, null], position: { row: 3, col: 3 } },
    // Row 4
    { id: 10, students: [null, null], position: { row: 4, col: 1 } },
    { id: 11, students: [null, null], position: { row: 4, col: 2 } },
    { id: 12, students: [null, null], position: { row: 4, col: 3 } },

    // Single desk: TODO
    // { id: 13, students: [null], position: { row: 4, col: 3 } },
  ],
}

// Interactive Performance Chart Component using shadcn charts
function InteractivePerformanceChart({
  studentData,
}: {
  studentData: (typeof students)[0]
}) {
  // Combine classroom and student data for the chart
  const chartData = classroomPerformance.map((classPoint, index) => ({
    week: classPoint.week,
    classroom: classPoint.score,
    student: studentData.performanceHistory[index]?.score || 0,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div
        className="bg-white border border-2 border-gray-400 shadow-lg py-3 px-5 rounded-2xl ml-8"
        style={{
          transform: 'translateY(-10px)',
        }}
      >
        <span
          style={{
            color: '#3C3C3C',
            fontFamily: 'DM Sans',
            fontSize: '1.1rem',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '125%',
            letterSpacing: '0.16px',
          }}
        >
          Performance
        </span>

        <br />

        <p className="text-sm font-small bg-gray-100 rounded-xl px-2 py-1 text-gray-500 mt-2 flex justify-between items-center">
          <span>Class</span>
          <span className="font-bold text-gray-700">{payload[0].value}</span>
        </p>
        <p className="text-sm font-small bg-gray-100 rounded-xl px-2 py-1 text-gray-500 mt-3 flex justify-between items-center">
          <span>Student</span>
          <span className="font-bold text-gray-900">{payload[1].value}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ChartContainer
        config={{
          classroom: {
            label: 'Class',
            color: '#3b82f6',
          },
          student: {
            label: studentData.name.split(' ')[0],
            color: '#3b82f6',
          },
        }}
        className="h-full w-full p-0 m-0"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 0, right: 15, left: 15, bottom: 5 }}
          >
            <defs>
              <linearGradient
                id="classroomAreaGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="20%" stopColor="#EA8963" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#EA8963" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#EA8963" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient
                id="studentAreaGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="20%" stopColor="#EA8963" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#EA8963" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#EA8963" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value: any) => ``}
            />
            <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
            <ChartTooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: '#e5e7eb',
                strokeWidth: 1,
                strokeDasharray: '3 3',
              }}
            />

            {/* Area fills for gradients */}
            <Area
              type="monotone"
              dataKey="classroom"
              stroke="none"
              fill="url(#classroomAreaGradient)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="student"
              stroke="none"
              fill="url(#studentAreaGradient)"
              fillOpacity={1}
            />

            {/* Class performance line */}
            <Line
              type="monotone"
              dataKey="classroom"
              stroke="#EA8963"
              strokeWidth={1}
              dot={{ fill: '#fb923c', stroke: '#fb923c', strokeWidth: 2, r: 0 }}
              activeDot={{
                r: 6,
                fill: '#E25A26',
                // stroke: '#ffffff',
                // strokeWidth: 2,
              }}
              connectNulls={false}
            />

            {/* Student performance line */}
            <Line
              type="monotone"
              dataKey="student"
              stroke="#EA8963"
              strokeWidth={1}
              dot={{
                fill: '#E25A26',
                stroke: '#ffffff',
                // strokeWidth: 2,
                r: 0,
              }}
              activeDot={{
                r: 6,
                fill: '#E25A26',
                // stroke: '#ffffff',
                // strokeWidth: 2,
              }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}

export default function Component() {
  const [currentStudent, setCurrentStudent] = useState(students[0])
  const [searchTerm, setSearchTerm] = useState('')

  const handleStudentClick = (studentId: number | null) => {
    if (studentId) {
      const student = students.find((s) => s.id === studentId)
      if (student) {
        setCurrentStudent(student)
      }
    }
  }

  const getStudentById = (id: number | null) => {
    if (!id) return null
    return students.find((s) => s.id === id)
  }

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex gap-6 px-6 h-full">
      {/* Left Panel - Classroom Layout */}
      <div className="flex-1 w-7/12">
        <Card className="h-full overflow-hidden border-2">
          <CardContent className="p-6 w-full h-full">
            {/* Header */}

            <div className="w-full mb-6 flex justify-center items-center">
              <Card
                className="w-2/3 bg-white border border-gray-400 border-2 shadow-sm"
                style={{
                  background:
                    'linear-gradient(70deg, #E8E8E8 -68.25%, #F5F5F5 41.43%)',
                }}
              >
                <CardContent className="flex items-center justify-between px-10 py-5 rounded-2xl">
                  {/* <div className=""> */}

                  <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold text-gray-800">
                      Class 10b
                    </h1>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                        <Users className="w-4 h-4" />
                        <span>20</span>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                        <User className="w-4 h-4" />
                        <span>1</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                    <Input
                      placeholder="Search for a student"
                      className="pl-11 pr-4 py-6 w-64 bg-white border-gray-400 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {/* </div> */}
                </CardContent>
              </Card>
            </div>

            {/* Classroom Grid */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-4 gap-6 max-w-4xl mx-auto">
                {classroom.desks.map((desk) => (
                  <div
                    key={desk.id}
                    className={`
                      ${
                        desk.students.length === 1 ? 'col-span-1' : 'col-span-1'
                      }
                      ${
                        desk.position.row === 4 && desk.position.col === 4
                          ? 'justify-self-end'
                          : ''
                      }
                    `}
                  >
                    {desk.students.length === 1 ? (
                      // Single desk
                      <div className="w-48 h-48 flex items-center justify-center">
                        <svg
                          width="180"
                          height="180"
                          viewBox="0 0 180 180"
                          className="drop-shadow-sm"
                        >
                          <defs>
                            <linearGradient
                              id="deskShadowSingle"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#9ca3af"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="100%"
                                stopColor="#374151"
                                stopOpacity={1}
                              />
                            </linearGradient>
                          </defs>

                          {/* Single chair with realistic backrest */}
                          <g>
                            {/* Chair seat */}
                            <ellipse
                              cx="90"
                              cy="30"
                              rx="24"
                              ry="15"
                              fill="#e5e7eb"
                              stroke="#d1d5db"
                              strokeWidth="1"
                            />
                            {/* Chair backrest */}
                            <rect
                              x="66"
                              y="12"
                              width="48"
                              height="27"
                              rx="12"
                              ry="12"
                              fill="#e5e7eb"
                              stroke="#d1d5db"
                              strokeWidth="1"
                            />
                            <rect
                              x="69"
                              y="15"
                              width="42"
                              height="21"
                              rx="9"
                              ry="9"
                              fill="#f3f4f6"
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                            {/* Chair legs (simplified) */}
                            <line
                              x1="72"
                              y1="45"
                              x2="72"
                              y2="52"
                              stroke="#d1d5db"
                              strokeWidth="3"
                            />
                            <line
                              x1="108"
                              y1="45"
                              x2="108"
                              y2="52"
                              stroke="#d1d5db"
                              strokeWidth="3"
                            />
                          </g>

                          {/* Single desk */}
                          <rect
                            x="45"
                            y="52"
                            width="90"
                            height="60"
                            rx="12"
                            ry="12"
                            fill="#f9fafb"
                            stroke="#d1d5db"
                            strokeWidth="1"
                          />
                          <rect
                            x="48"
                            y="55"
                            width="84"
                            height="54"
                            rx="9"
                            ry="9"
                            fill="#ffffff"
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />

                          {/* Student avatar */}
                          {desk.students[0] &&
                            getStudentById(desk.students[0]) && (
                              <g>
                                <circle
                                  cx="90"
                                  cy="82"
                                  r="21"
                                  fill="#f3f4f6"
                                  stroke="#d1d5db"
                                  strokeWidth="1"
                                />
                                <foreignObject
                                  x="69"
                                  y="61"
                                  width="42"
                                  height="42"
                                >
                                  <button
                                    onClick={() =>
                                      handleStudentClick(desk.students[0])
                                    }
                                    className={`
                                    w-10 h-10 rounded-full overflow-hidden border transition-all
                                    ${
                                      currentStudent?.id === desk.students[0]
                                        ? 'border-orange-500 ring-1 ring-orange-200'
                                        : 'border-gray-300 hover:border-gray-400'
                                    }
                                  `}
                                  >
                                    <img
                                      src={
                                        getStudentById(desk.students[0])
                                          ?.avatar || '/placeholder.svg'
                                      }
                                      alt={
                                        getStudentById(desk.students[0])?.name
                                      }
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                </foreignObject>
                              </g>
                            )}
                        </svg>
                      </div>
                    ) : (
                      // Double desk
                      <div className="w-60 h-148 flex items-center justify-center">
                        <svg
                          width="240"
                          height="180"
                          viewBox="0 0 240 180"
                          className="drop-shadow-sm"
                        >
                          <defs>
                            <linearGradient
                              id="deskShadowDouble"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#9ca3af"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="100%"
                                stopColor="#374151"
                                stopOpacity={1}
                              />
                            </linearGradient>
                          </defs>

                          {/* Chair backs with realistic design */}
                          <g>
                            {/* Left chair */}
                            <ellipse
                              cx="60"
                              cy="45"
                              rx="24"
                              ry="15"
                              fill="#e5e7eb"
                              stroke="#626262"
                              strokeWidth="1"
                            />

                            <rect
                              x="36"
                              y="37"
                              width="48"
                              height="27"
                              rx="12"
                              ry="12"
                              fill="#e5e7eb"
                              stroke="#d1d5db"
                              strokeWidth="0"
                            />

                            <rect
                              x="36"
                              y="55"
                              width="48"
                              height="10"
                              rx="0"
                              ry="0"
                              fill="#e5e7eb"
                              stroke="#d1d5db"
                              strokeWidth="0"
                            />

                            <line
                              x1="36"
                              y1="55"
                              x2="36"
                              y2="44"
                              stroke="#626262"
                              strokeWidth="1"
                            />

                            <line
                              x1="84"
                              y1="55"
                              x2="84"
                              y2="44"
                              stroke="#626262"
                              strokeWidth="1"
                            />

                            {/* Right chair */}
                            <ellipse
                              cx="180"
                              cy="45"
                              rx="24"
                              ry="15"
                              fill="#e5e7eb"
                              stroke="#626262"
                              strokeWidth="1"
                            />

                            <rect
                              x="156"
                              y="37"
                              width="48"
                              height="27"
                              rx="12"
                              ry="12"
                              fill="#e5e7eb"
                              stroke="#d1d5db"
                              strokeWidth="0"
                            />

                            <rect
                              x="156"
                              y="55"
                              width="48"
                              height="10"
                              rx="0"
                              ry="0"
                              fill="#e5e7eb"
                              stroke="#d1d5db"
                              strokeWidth="0"
                            />

                            <line
                              x1="156"
                              y1="55"
                              x2="156"
                              y2="44"
                              stroke="#626262"
                              strokeWidth="1"
                            />

                            <line
                              x1="204"
                              y1="55"
                              x2="204"
                              y2="44"
                              stroke="#626262"
                              strokeWidth="1"
                            />
                          </g>

                          {/* Desk shadow/border at front */}
                          {/* <rect x="22" y="108" width="196" height="8" rx="4" ry="4" fill="url(#deskShadowDouble)" /> */}

                          {/* Desk surface */}
                          {/* <rect
                            x="22"
                            y="52"
                            width="196"
                            height="100"
                            rx="15"
                            ry="15"
                            fill="#f9fafb"
                            stroke="#d1d5db"
                            strokeWidth="1"
                          /> */}

                          {/* Desk Shadow */}
                          <rect
                            x="25"
                            y="59"
                            width="190"
                            height="94"
                            rx="12"
                            ry="12"
                            fill="#626262"
                            stroke="#626262"
                            strokeWidth="2"
                          />

                          <rect
                            x="25"
                            y="55"
                            width="190"
                            height="94"
                            rx="12"
                            ry="12"
                            fill="#F4F4F4"
                            stroke="#626262"
                            strokeWidth="2"
                          />

                          {/* Student avatars */}
                          {desk.students.map((studentId, index) => {
                            const student = getStudentById(studentId)
                            const xPos = index === 0 ? 65 : 172
                            return (
                              <g key={index}>
                                {/* TODO: only include circle if there is no student present  */}
                                {/* <circle cx={xPos} cy="102" r="25" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" /> */}
                                {student ? (
                                  <foreignObject
                                    x={xPos - 30}
                                    y="71"
                                    width="62"
                                    height="62"
                                  >
                                    <button
                                      onClick={() =>
                                        handleStudentClick(studentId)
                                      }
                                      className={`
                                        w-17 h-17 rounded-full overflow-hidden border border-[3px] transition-all
                                        ${
                                          currentStudent?.id === studentId
                                            ? 'border-orange-500'
                                            : 'border-gray-300 hover:border-gray-500'
                                        }
                                      `}
                                    >
                                      <img
                                        src={
                                          student.avatar || '/placeholder.svg'
                                        }
                                        alt={student.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  </foreignObject>
                                ) : (
                                  <circle
                                    cx={xPos}
                                    cy="102"
                                    r="25"
                                    fill="#f3f4f6"
                                    stroke="#d1d5db"
                                    strokeWidth="2"
                                  />
                                )}
                              </g>
                            )
                          })}
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Student Details */}
      <Card className="space-y-6 w-5/12 p-0 overflow-hidden border border-[2px] box-border h-full">
        <CardContent
          className="p-0 h-full"
          style={{
            background:
              'linear-gradient(238deg, #F4F4F4 71.2%, #DBDBDB 124.63%)',
          }}
        >
          {/* <div className="p-6 space-y-6 w-4/12"> */}
          {/* Student Profile */}
          <Card className="rounded-none border-none">
            <CardContent
              className="p-0 border-b-[2px] border-gray-400"
              style={{ backgroundColor: '#EBEBEB' }}
            >
              <div className="p-6 flex items-center gap-4 mb-4">
                <img
                  src={currentStudent.avatar || '/placeholder.svg'}
                  alt={currentStudent.name}
                  className="w-16 h-16 rounded-full"
                />
                <div className="flex-1">
                  <h2 className="font-semibold text-xl">
                    {currentStudent.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {currentStudent.age} Years • {currentStudent.grade}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 rounded-lg"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg bg-transparent"
                  >
                    <BookOpen className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-6 flex flex-col gap-6">
            {/* Interactive Performance Chart */}
            <Card className="rounded-2xl mt-4 border-2">
              <CardContent className="p-0">
                <div
                  className="mb-6 px-6 pt-6"
                  style={{ marginBottom: '-1rem' }}
                >
                  <h3 className="font-semibold text-lg">Performance</h3>
                  <p className="text-xs text-gray-500">
                    Performance comparison to class
                  </p>
                </div>
                <InteractivePerformanceChart studentData={currentStudent} />
              </CardContent>
            </Card>

            {/* Statistics Row */}
            <div className="flex gap-4">
              {/* Three Statistics Grouped */}
              <Card className="rounded-2xl flex-1 border-2 items-center w-3/4">
                <CardContent className="p-6 grid grid-cols-3 gap-4 items-center h-full">
                  <Card>
                    <CardContent className="text-center py-4 px-2 bg-gray-50 rounded-xl flex flex-col items-center">
                      <div className="text-3xl font-bold flex items-center text-gray-900 gap-1">
                        <NotebookPen color={'#848484'} className="w-10 h-10" />
                        {currentStudent.exercises}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Exercises this week
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="text-center py-4 px-2 bg-gray-50 rounded-xl flex flex-col items-center">
                      <div className="text-3xl font-bold flex items-center h-full text-gray-900 gap-1">
                        <Backpack color="#848484" className="w-10 h-10" />
                        {currentStudent.homework}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Homework this week
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="text-center py-4 px-2 bg-gray-50 rounded-xl flex flex-col items-center">
                      <div className="text-3xl font-bold flex items-center text-gray-900 gap-1">
                        <Smile color="#848484" className="w-10 h-10" />
                        {currentStudent.satisfaction}%
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Exercise satisfaction
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              {/* Proficiency Gauge */}
              <Card className="rounded-2xl w-1/4">
                <CardContent className="px-6 py-2 text-center">
                  <div className="relative w-22 h-22 mx-auto mb-3">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#E25A26"
                        strokeWidth="2"
                        strokeDasharray={`${currentStudent.performance}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900">
                        {currentStudent.performance}%
                      </span>
                      <div className="text-xs text-gray-500">Proficiency</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Exercise Log */}
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg">Exercise Log</h3>
                  <p className="text-sm text-gray-500">
                    Recent exercise submissions
                  </p>
                </div>

                <div className="space-y-3 max-h-[18rem] overflow-y-auto">
                  {currentStudent.exerciseHistory.map((exercise, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <span className="text-sm font-medium truncate flex-1 mr-3">
                        {exercise.name}
                      </span>
                      <div className="flex-shrink-0">
                        {exercise.passed ? (
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
