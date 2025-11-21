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
  Sigma,
  Tags,
  Video,
} from 'lucide-react'
import { SiYoutube } from '@icons-pack/react-simple-icons'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { useTranslations } from 'next-intl' // added

export const ToolbarButtons = ({ editor, props }: any) => {
  const t = useTranslations('ToolbarButtons') // added
  if (!editor) {
    return null
  }

  // YouTube extension
  const addYoutubeVideo = () => {
    const url = prompt(t('prompts.youtubeUrl')) // translated
    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
        width: 640,
        height: 480,
      })
    }
  }

  return (
    <ToolButtonsWrapper>
      <ToolTip content={t('tooltips.undo')}>
        <ToolBtn onClick={() => editor.chain().focus().undo().run()}>
          <ArrowLeftIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.redo')}>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()}>
          <ArrowRightIcon />
        </ToolBtn>
      </ToolTip>

      <ToolTip content={t('tooltips.bold')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
        >
          <FontBoldIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.italic')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
        >
          <FontItalicIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.strike')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
        >
          <StrikethroughIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.orderedList')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
        >
          <ListBulletIcon />
        </ToolBtn>
      </ToolTip>

      <ToolSelect
        onChange={(e) =>
          editor
            .chain()
            .focus()
            .toggleHeading({ level: parseInt(e.target.value) })
            .run()
        }
        aria-label={t('headings.label')}
      >
        <option value="1">{t('headings.h1')}</option>
        <option value="2">{t('headings.h2')}</option>
        <option value="3">{t('headings.h3')}</option>
        <option value="4">{t('headings.h4')}</option>
        <option value="5">{t('headings.h5')}</option>
        <option value="6">{t('headings.h6')}</option>
      </ToolSelect>

      <DividerVerticalIcon
        style={{ marginTop: 'auto', marginBottom: 'auto', color: 'grey' }}
      />

      <ToolTip content={t('tooltips.createTable')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.insertRow')}>
        <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()}>
          <RowsIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.insertColumn')}>
        <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <ColumnsIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.removeColumn')}>
        <ToolBtn onClick={() => editor.chain().focus().deleteColumn().run()}>
          <ContainerIcon />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.removeRow')}>
        <ToolBtn onClick={() => editor.chain().focus().deleteRow().run()}>
          <SectionIcon />
        </ToolBtn>
      </ToolTip>

      <DividerVerticalIcon
        style={{ marginTop: 'auto', marginBottom: 'auto', color: 'grey' }}
      />

      <ToolTip content={t('tooltips.infoCallout')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleNode('calloutInfo').run()}
        >
          <AlertCircle size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.warningCallout')}>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().toggleNode('calloutWarning').run()
          }
        >
          <AlertTriangle size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.image')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockImage',
              })
              .run()
          }
        >
          <ImagePlus size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.video')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockVideo',
              })
              .run()
          }
        >
          <Video size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.youtube')}>
        <ToolBtn onClick={() => addYoutubeVideo()}>
          <SiYoutube size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.math')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockMathEquation',
              })
              .run()
          }
        >
          <Sigma size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.pdf')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockPDF',
              })
              .run()
          }
        >
          <FileText size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.quiz')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockQuiz',
              })
              .run()
          }
        >
          <BadgeHelp size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.codeBlock')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
        >
          <Code size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.embed')}>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertContent({ type: 'blockEmbed' }).run()
          }
        >
          <Cuboid size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.badges')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'badge',
                content: [
                  {
                    type: 'text',
                    text: t('defaults.badgeText'), // translated
                  },
                ],
              })
              .run()
          }
        >
          <Tags size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('tooltips.button')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'button',
                content: [
                  {
                    type: 'text',
                    text: t('defaults.buttonText'), // translated
                  },
                ],
              })
              .run()
          }
        >
          <MousePointerClick size={15} />
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
