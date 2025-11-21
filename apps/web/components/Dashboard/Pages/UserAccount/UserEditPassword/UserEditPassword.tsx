import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { updatePassword } from '@services/settings/password'
import { Formik, Form, Field } from 'formik'
import { Card } from "@components/ui/card";
import React, { useEffect } from 'react'
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'

function UserEditPassword() {
  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('UserEditPassword')

  const updatePasswordUI = async (values: any) => {
    try {
      const user_id = session.data.user.id
      const res = await updatePassword(user_id, values, access_token)
      if (res?.status === 200) {
        toast.success(t('toast.success'))
      } else {
        toast.error(t('toast.error', { status: res?.status ?? '—', detail: res?.data?.detail ?? '' }))
      }
    } catch (e: any) {
      toast.error(t('toast.error', { status: e?.status ?? '—', detail: e?.message ?? '' }))
    }
  }

  useEffect(() => { }, [session])

  return (
    <Card className="ml-10 mr-10 bg-white rounded-xl px-6 py-5">
      <Formik
        initialValues={{ old_password: '', new_password: '' }}
        enableReinitialize
        onSubmit={(values, { setSubmitting }) => {
          setTimeout(() => {
            setSubmitting(false)
            updatePasswordUI(values)
          }, 400)
        }}
      >
        {({ isSubmitting }) => (
          <Form className="max-w-md">
            <label className="block mb-2 font-bold" htmlFor="old_password">
              {t('labels.oldPassword')}
            </label>
            <Field
              className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="password"
              name="old_password"
              placeholder={t('placeholders.oldPassword')}
              aria-label={t('labels.oldPassword')}
              autoComplete="current-password"
            />

            <label className="block mb-2 font-bold" htmlFor="new_password">
              {t('labels.newPassword')}
            </label>
            <Field
              className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="password"
              name="new_password"
              placeholder={t('placeholders.newPassword')}
              aria-label={t('labels.newPassword')}
              autoComplete="new-password"
            />

            <Button
              variant={'default'}
              disabled={isSubmitting}
              className="px-6 py-3 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('buttons.submit')}
            >
              {t('buttons.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </Card>
  )
}

export default UserEditPassword
