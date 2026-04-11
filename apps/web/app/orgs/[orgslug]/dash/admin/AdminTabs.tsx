"use client"

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers'

type DebugItem = {
  label: string
  value: string
}

type AdminTabsProps = {
  debugItems: DebugItem[]
}

function AdminTabs({ debugItems }: AdminTabsProps) {
  return (
    <Tabs defaultValue="hosting" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="hosting">Hosting</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
      </TabsList>
      <TabsContent value="hosting">
        <div className="bg-white nice-shadow rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Key</th>
                <th className="px-4 py-3 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {debugItems.map((item) => (
                <tr key={item.label} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                    {item.label}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 break-all">
                    {item.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>
      <TabsContent value="users">
        <OrgUsers />
      </TabsContent>
    </Tabs>
  )
}

export default AdminTabs
