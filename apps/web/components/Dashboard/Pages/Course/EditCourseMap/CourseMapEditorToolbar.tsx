import styled from 'styled-components'
import {
  FontBoldIcon,
  FontItalicIcon,
  StrikethroughIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DividerVerticalIcon,
  ListBulletIcon,
  TableIcon,
  RowsIcon,
  ColumnsIcon,
  SectionIcon,
  ContainerIcon,
} from '@radix-ui/react-icons'
import {
  AlertCircle,
  AlertTriangle,
  BadgeHelp,
  Code,
  Cuboid,
  FileText,
  ImagePlus,
  MousePointerClick,
  RedoIcon,
  Sigma,
  Tags,
  Trash2Icon,
  UndoIcon,
  Video,
} from 'lucide-react'
import { SiYoutube } from '@icons-pack/react-simple-icons'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'

export interface CourseMapEditorToolbarProps {
    undo: Function,
    redo: Function,
    reset: Function,
}

export const CourseMapEditorToolbar = (props: CourseMapEditorToolbarProps) => {
  return (
    <ToolButtonsWrapper>
      <ToolTip content={'Undo'}>
        <ToolBtn onClick={() => props.undo()}>
            <UndoIcon  />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Redo'}>
        <ToolBtn onClick={() => props.redo()}>
            <RedoIcon />
        </ToolBtn>
      </ToolTip>
      <DividerVerticalIcon
        style={{ marginTop: 'auto', marginBottom: 'auto', color: 'grey' }}
      />
      <ToolTip content={'Reset State'}>
        <ToolBtn
            onClick={() => props.reset()}
        >
            <Trash2Icon className='text-red-800'/>
        </ToolBtn>
      </ToolTip>
    </ToolButtonsWrapper>
  )
}

const ToolButtonsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: left;
  justify-content: left;
`

const ToolBtn = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(217, 217, 217, 0.24);
  border-radius: 6px;
  width: 25px;
  height: 25px;
  padding: 5px;
  margin-right: 5px;
  transition: all 0.2s ease-in-out;

  svg {
    padding: 1px;
  }

  &.is-active {
    background: rgba(176, 176, 176, 0.5);

    &:hover {
      background: rgba(139, 139, 139, 0.5);
      cursor: pointer;
    }
  }

  &:hover {
    background: rgba(217, 217, 217, 0.48);
    cursor: pointer;
  }
`

const ToolSelect = styled.select`
  display: flex;
  background: rgba(217, 217, 217, 0.185);
  border-radius: 6px;
  width: 100px;
  border: none;
  height: 25px;
  padding: 5px;
  font-size: 11px;
  font-family: 'DM Sans';
  margin-right: 5px;
`
