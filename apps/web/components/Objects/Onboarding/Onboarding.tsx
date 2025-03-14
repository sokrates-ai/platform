import Image, { StaticImageData } from 'next/image';
import React, { useEffect, useState } from 'react';
import OnBoardWelcome from '@public/onboarding/OnBoardWelcome.png';
import OnBoardCourses from '@public/onboarding/OnBoardCourses.png';
import OnBoardActivities from '@public/onboarding/OnBoardActivities.png';
import OnBoardEditor from '@public/onboarding/OnBoardEditor.png';
import OnBoardAI from '@public/onboarding/OnBoardAI.png';
import OnBoardUGs from '@public/onboarding/OnBoardUGs.png';
import OnBoardAccess from '@public/onboarding/OnBoardAccess.png';
import OnBoardMore from '@public/onboarding/OnBoardMore.png';
import { ArrowRight, Book, Check, Globe, Info, PictureInPicture, Sparkle, Sprout, SquareUser, ArrowRightLeft, ArrowLeftRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUriWithOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@components/ui/badge'

interface OnboardingStep {
  imageSrc: StaticImageData;
  title: string;
  description: string;
  buttons?: {
    label: string;
    action: () => void;
    icon?: React.ReactNode;
  }[];
}

const Onboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);
  const router = useRouter();
  const org = useOrg() as any;
  const isUserAdmin = useAdminStatus() as any;

  const onboardingData: OnboardingStep[] = [
    {
      imageSrc: OnBoardWelcome,
      title: 'Teach the world!',
      description: 'Welcome to LearnHouse, a LMS engineered for simplicity, ease of use and performance, meet the new way to create, share, and engage with educational content.',
    },
    {
      imageSrc: OnBoardCourses,
      title: 'Create Courses',
      description: 'Courses are the main building blocks of LearnHouse, they always contain Chapters and Chapters contain Activities.',
      buttons: [
        {
          label: 'Create New Course',
          action: () => router.push(getUriWithOrg(org?.slug, '/courses?new=true')),
          icon: <Book size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardActivities,
      title: 'Activities',
      description: 'Activities are elements you can add to your Courses via Chapters, they can be : Dynamic Pages, Videos, Documents, Quizz and more soon.',
      buttons: [
        {
          label: 'Learn more about activities',
          action: () => window.open('https://university.learnhouse.io/course/be89716c-9992-44bb-81df-ef3d76e355ba', '_blank'),
          icon: <Info size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardEditor,
      title: 'Dynamic pages and The Editor',
      description: 'Dynamic pages are pages with dynamic content, like Notion pages they can contain various components like Quizzes, Images, Videos, Documents etc',
      buttons: [
        {
          label: 'Learn more about Dynamic Pages and The Editor',
          action: () => window.open('https://university.learnhouse.io/course/be89716c-9992-44bb-81df-ef3d76e355ba', '_blank'),
          icon: <Info size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardAI,
      title: 'Artificial Intelligence',
      description: 'Tools for tought made for teachers and students alike, context aware it can reply based on your courses and the unique content you create on LearnHouse',
      buttons: [
        {
          label: 'Learn more about LearnHouse AI',
          action: () => window.open('https://docs.learnhouse.app/features/ai/students', '_blank'),
          icon: <Sparkle size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardUGs,
      title: 'Group students and streamline access ',
      description: 'With UserGroups you can separate students by Groups and give access to Courses depending on their needs',
      buttons: [
        {
          label: 'Create UserGroups',
          action: () => router.push(getUriWithOrg(org?.slug, '/dash/users/settings/usergroups')),
          icon: <SquareUser size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardAccess,
      title: 'Choose whether to make Courses available on the Web or not ',
      description: 'You can choose to make your Courses discoverable from search engines and accesible to non authenticated users or to only give it to authenticated Users',
      buttons: [

      ],
    },
    {
      imageSrc: OnBoardMore,
      title: 'To infinity and beyond',
      description: "To Learn more about LearnHouse, you're welcome to follow our Original courses on the LearnHouse University",
      buttons: [
        {
          label: 'LearnHouse University',
          action: () => window.open('https://university.learnhouse.io', '_blank'),
          icon: <Globe size={16} />,
        },
      ],
    },
  ];

  useEffect(() => {
    // Check if onboarding is already completed in local storage
    const isOnboardingCompleted = localStorage.getItem('isOnboardingCompleted');
    setIsOnboardingComplete(isOnboardingCompleted === 'true');
    setIsModalOpen(!isOnboardingCompleted); // Show modal if onboarding is not completed
  }, []);

  const nextStep = () => {
    if (currentStep < onboardingData.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Mark onboarding as completed in local storage
      localStorage.setItem('isOnboardingCompleted', 'true');
      setIsModalOpen(false); // Close modal after completion
      setIsOnboardingComplete(true); // Show success message
      console.log('Onboarding completed');
    }
  };

  const skipOnboarding = () => {
    // Mark onboarding as completed in local storage
    localStorage.setItem('isOnboardingCompleted', 'true');
    setIsModalOpen(false); // Close modal after skipping
    console.log('Onboarding skipped');
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < onboardingData.length) {
      setCurrentStep(index);
    }
  };



  return (
    <div>
      {isUserAdmin.isAdmin && !isUserAdmin.loading && !isOnboardingComplete && 
      
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} >
          <DialogTrigger asChild>
            <div className=' fixed pb-10 w-full bottom-0 bg-gradient-to-t from-1% from-gray-950/25 to-transparent'>
              <div className='bg-gray-950 flex space-x-1 font-bold cursor-pointer hover:bg-gray-900 shadow-md items-center text-gray-200 px-5 py-2 w-fit rounded-full mx-auto'>
                <ArrowLeftRight size={20} />
                <ArrowRightLeft size={20} />
                <p>Onboarding</p>
                <div className='h-2 w-2 bg-blue-500 animate-pulse rounded-full'></div>
              </div>
            </div>
          </DialogTrigger>
          <DialogContent  className= "w-[700px] h-[600px] max-w-full max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Onboarding</DialogTitle>
            </DialogHeader>
            <OnboardingScreen
              step={onboardingData[currentStep]}
              onboardingData={onboardingData}
              currentStep={currentStep}
              nextStep={nextStep}
              skipOnboarding={skipOnboarding}
              setIsModalOpen={setIsModalOpen}
              goToStep={goToStep}
            />
          </DialogContent>
        </Dialog>}
        </div>
  );
};

interface OnboardingScreenProps {
  step: OnboardingStep;
  currentStep: number;
  nextStep: () => void;
  skipOnboarding: () => void;
  goToStep: (index: number) => void;
  setIsModalOpen: (value: boolean) => void;
  onboardingData: OnboardingStep[];
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  step,
  currentStep,
  nextStep,
  skipOnboarding,
  goToStep,
  onboardingData,
  setIsModalOpen,
}) => {
  const isLastStep = currentStep === onboardingData.length - 1;

  return (
    <div className='flex flex-col'>
      <div className='onboarding_screens flex-col px-4 py-4'>
        <div className='flex-grow rounded-xl'>
          <Image unoptimized className='mx-auto shadow-md shadow-gray-200 rounded-lg aspect-auto' alt='' priority quality={100} src={step.imageSrc} />
        </div>
        <div className='grid grid-flow-col justify-stretch space-x-3 mt-4'>
        {onboardingData.map((_, index) => (
            <Badge
              key={index}
              onClick={() => goToStep(index)}
              className={cn("h-[7px] w-15 rounded-full cursor-pointer transition-all", {
                "bg-black": index === currentStep,
                "bg-gray-300 hover:bg-gray-500": index !== currentStep,
              })}
            />
          ))}
        </div>
      </div>
      <div className='onboarding_text flex flex-col h-[90px] py-2 px-4 leading-tight'>
        <h2 className='text-xl font-bold'>{step.title}</h2>
        <p className='text-md font-normal'>{step.description}</p>
      </div>
      <div className='onboarding_actions flex flex-row-reverse w-full px-4'>
        <div className='flex flex-row justify-between w-full py-2'>
          <div className='utils_buttons flex flex-row space-x-2'>

            <Button
              variant='destructive'
              onClick={() => setIsModalOpen(false)}
            >
              <PictureInPicture size={16} />
            </Button>
          </div>

          <div className='actions_buttons flex space-x-2'>
            {step.buttons?.map((button, index) => (
              <Button
                key={index}
                onClick={button.action}
              >
                <p>{button.label}</p>
                {button.icon}
              </Button>
            ))}
            {isLastStep ? (
              <Button onClick={nextStep}>
                <p>Finish Onboarding</p>
                <Check size={16} />
              </Button>
            ) : (
              
              <Button onClick={nextStep}>
                Next
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;