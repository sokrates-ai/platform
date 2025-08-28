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
import { getAvatarUrl } from '@components/Objects/avatar'
import { getMediaUrl } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { ApiStudent } from './shared'


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

// Classroom layout - defines which students sit at which desks

// Interactive Performance Chart Component using shadcn charts
function InteractivePerformanceChart({
  studentData,
}: {
  studentData: ApiStudent
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

interface ContentStudent {
        id: number,
        name: string,
        age: number,
        grade: string,
        avatar: string,
        exercises: number,
        homework: number,
        satisfaction: number,
        performance: number,
        performanceHistory: PerformancePoint[],
        exerciseHistory: ExerciseLog[],
}

export interface PerformancePoint {
       week: number,
       score: number,
}

export interface ExerciseLog {
      name: string,
      passed: boolean,
}

export default function Component(props: {apiStudents: ApiStudent[], orgslug: string}) {
  const students = props.apiStudents.map((s) => {
      console.dir(s)
      const displayName = (s.first_name) ? (
        (s.first_name && s.last_name) ? (`${s.first_name} ${s.last_name}`) : s.first_name
      ) : s.email


      const avatar = s.avatar_image ? `${getMediaUrl()}content/users/${s.user_uuid}/avatars/${s.avatar_image}` : '/empty_avatar.png'
      console.log(avatar)

      return {
        id: s.id,
        name: displayName,
        age: 0,
        grade: "",
        avatar,
        exercises: 0,
        homework: 0,
        satisfaction: 0,
        performance: 0,
        performanceHistory: [],
        exerciseHistory: [],
      } as ContentStudent
  })

  // const classroom = students.map((value, index) => {
  //
  // })

  let desks = []

  let row = 1
  let col = 1

  for (const student of students) {
      let currentDesk = desks[desks.length == 0 ? 0 : desks.length - 1]

      console.dir(currentDesk)

      if (!currentDesk || currentDesk.students.length == 2) {
          desks.push(
            { id: desks.length + 1, students: [student.id], position: { row, col } },
          )

          // Advance position
          col += 1
          if (col > 3) {
              col = 1
              row += 1
          }

          continue;
      }

      currentDesk.students.push(student.id)
  }

  const classroom = { desks }

  // const classroooom = {
  // desks: [
  //   // Row 1
  //   { id: 1, students: [1, 2], position: { row: 1, col: 1 } },
  //   { id: 2, students: [3, 4], position: { row: 1, col: 2 } },
  //   { id: 3, students: [5, 6], position: { row: 1, col: 3 } },
  //   // Single desk: TODO
  //   // { id: 13, students: [null], position: { row: 4, col: 3 } },
  // ],

  const [currentStudent, setCurrentStudent] = useState(students[0])
  const [searchTerm, setSearchTerm] = useState('')

  // const students = fetch(
  //   `${getAPIUrl()}courses/students/list?course_uuid=${course_id}`,
  //   RequestBodyFormWithAuthHeader('POST', formData, null, access_token)
  // )
  //   .then((result) => result.json())
  //   .catch((error) => console.log('error', error))

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
                        Student Overview
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
