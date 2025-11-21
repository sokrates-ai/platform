import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form';
import { useFormik } from 'formik';
import { AlertTriangle } from 'lucide-react';
import * as Form from '@radix-ui/react-form';
import React, { useEffect, useState } from 'react';
import ThumbnailUpdate from './ThumbnailUpdate';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { useTranslations } from 'next-intl'

type EditCourseStructureProps = {
  orgslug: string
  course_uuid?: string
}

function EditCourseGeneral(props: EditCourseStructureProps) {
  const t = useTranslations('EditCourseGeneral')
  const [error, setError] = useState('');
  const course = useCourse();
  const dispatchCourse = useCourseDispatch() as any;
  const { isLoading, courseStructure } = course as any;

  const validate = (values: any) => {
    const errors = {} as any;

    if (!values.name) {
      errors.name = t('validation.required');
    } else if (values.name.length > 100) {
      errors.name = t('validation.max', { count: 100 });
    }

    if (!values.description) {
      errors.description = t('validation.required');
    } else if (values.description.length > 1000) {
      errors.description = t('validation.max', { count: 1000 });
    }

    if (!values.learnings) {
      errors.learnings = t('validation.required');
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: {
      name: courseStructure?.name || '',
      description: courseStructure?.description || '',
      about: courseStructure?.about || '',
      learnings: courseStructure?.learnings || '',
      tags: courseStructure?.tags || '',
      public: courseStructure?.public || '',
    },
    validate,
    onSubmit: async values => {
      try {
        // Add your submission logic here
        dispatchCourse({ type: 'setIsSaved' });
      } catch (e) {
        setError(t('errors.saveFailed'));
      }
    },
    enableReinitialize: true,
  }) as any;

  useEffect(() => {
    if (!isLoading) {
      const formikValues = formik.values as any;
      const initialValues = formik.initialValues as any;
      const valuesChanged = Object.keys(formikValues).some(
        key => formikValues[key] !== initialValues[key]
      );

      if (valuesChanged) {
        dispatchCourse({ type: 'setIsNotSaved' });
        const updatedCourse = {
          ...courseStructure,
          ...formikValues,
        };
        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
      }
    }
  }, [formik.values, isLoading]);

  return (
    <div>
      <div className="h-6"></div>
      <div className="ml-10 mr-10 mx-auto bg-white rounded-xl shadow-sm px-6 py-5">
        {courseStructure && (
          <div className="editcourse-form">
            {error && (
              <div className="flex justify-center bg-red-200 rounded-md text-red-950 space-x-2 items-center p-4 transition-all shadow-sm">
                <AlertTriangle size={18} />
                <div className="font-bold text-sm">{error}</div>
              </div>
            )}
            <FormLayout onSubmit={formik.handleSubmit}>
              <FormField name="name">
                <FormLabelAndMessage label={t('form.name.label')} message={formik.errors.name} />
                <Form.Control asChild>
                  <Input
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.name}
                    type="text"
                    required
                    aria-label={t('form.name.label')}
                  />
                </Form.Control>
              </FormField>

              <FormField name="description">
                <FormLabelAndMessage label={t('form.description.label')} message={formik.errors.description} />
                <Form.Control asChild>
                  <Input
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.description}
                    type="text"
                    required
                    aria-label={t('form.description.label')}
                  />
                </Form.Control>
              </FormField>

              <FormField name="about">
                <FormLabelAndMessage label={t('form.about.label')} message={formik.errors.about} />
                <Form.Control asChild>
                  <Textarea
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.about}
                    required
                    aria-label={t('form.about.label')}
                  />
                </Form.Control>
              </FormField>

              <FormField name="learnings">
                <FormLabelAndMessage label={t('form.learnings.label')} message={formik.errors.learnings} />
                <Form.Control asChild>
                  <Textarea
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.learnings}
                    required
                    aria-label={t('form.learnings.label')}
                  />
                </Form.Control>
              </FormField>

              <FormField name="tags">
                <FormLabelAndMessage label={t('form.tags.label')} message={formik.errors.tags} />
                <Form.Control asChild>
                  <Textarea
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.tags}
                    required
                    aria-label={t('form.tags.label')}
                  />
                </Form.Control>
              </FormField>

              <FormField name="thumbnail">
                <FormLabelAndMessage label={t('form.thumbnail.label')} />
                <Form.Control asChild>
                  <ThumbnailUpdate />
                </Form.Control>
              </FormField>
            </FormLayout>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditCourseGeneral;
