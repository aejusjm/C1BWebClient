// 간단한 HTML 에디터 컴포넌트
import { useState, useRef } from 'react'
import './SimpleHtmlEditor.css'

interface SimpleHtmlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SimpleHtmlEditor({ value, onChange, placeholder }: SimpleHtmlEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showColorPalette, setShowColorPalette] = useState<'none' | 'text' | 'background'>('none')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 색상 팔레트 (자주 사용하는 색상들)
  const colorPalette = [
    '#000000', '#424242', '#636363', '#9C9C94', '#CEC6CE', '#EFEFEF', '#F7F7F7', '#FFFFFF',
    '#FF0000', '#FF9C00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#9C00FF', '#FF00FF',
    '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#CFE2F3', '#D9D2E9', '#EAD1DC',
    '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#9FC5E8', '#B4A7D6', '#D5A6BD',
    '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6FA8DC', '#8E7CC3', '#C27BA0',
    '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3D85C6', '#674EA7', '#A64D79',
    '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#0B5394', '#351C75', '#741B47',
    '#660000', '#783F04', '#7F6000', '#274E13', '#0C343D', '#073763', '#20124D', '#4C1130'
  ]

  // 색상 팔레트 토글
  const toggleColorPalette = (type: 'text' | 'background') => {
    if (showColorPalette === type) {
      setShowColorPalette('none')
    } else {
      setShowColorPalette(type)
    }
  }

  // 색상 적용
  const applyColorFormat = (type: 'text' | 'background', color: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    let newText = ''
    if (type === 'text') {
      newText = `<span style="color:${color}">${selectedText || '텍스트'}</span>`
    } else {
      newText = `<span style="background-color:${color}">${selectedText || '텍스트'}</span>`
    }

    const newValue = value.substring(0, start) + newText + value.substring(end)
    onChange(newValue)

    // 팔레트 닫기
    setShowColorPalette('none')

    setTimeout(() => {
      textarea.focus()
      const newPosition = start + newText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // 텍스트 서식 적용
  const applyFormat = (tag: string, hasValue: boolean = false) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    let newText = ''
    if (hasValue) {
      // 링크, 이미지 등
      const inputValue = prompt(`${tag} 값을 입력하세요:`)
      if (!inputValue) return

      if (tag === 'link') {
        newText = `<a href="${inputValue}" target="_blank">${selectedText || '링크'}</a>`
      } else if (tag === 'image') {
        newText = `<img src="${inputValue}" alt="이미지" style="max-width:100%; height:auto;" />`
      }
    } else {
      // 일반 태그
      newText = `<${tag}>${selectedText || '텍스트'}</${tag}>`
    }

    const newValue = value.substring(0, start) + newText + value.substring(end)
    onChange(newValue)

    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + newText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // 제목 태그 적용
  const applyHeading = (level: number) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    const newText = `<h${level}>${selectedText || '제목'}</h${level}>`
    const newValue = value.substring(0, start) + newText + value.substring(end)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      const newPosition = start + newText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // 글자 크기 적용
  const applyFontSize = (size: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    const newText = `<span style="font-size:${size}px">${selectedText || '텍스트'}</span>`
    const newValue = value.substring(0, start) + newText + value.substring(end)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      const newPosition = start + newText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // 리스트 추가
  const applyList = (ordered: boolean) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    const tag = ordered ? 'ol' : 'ul'
    const items = selectedText.split('\n').filter(line => line.trim())
    const listItems = items.length > 0 
      ? items.map(item => `  <li>${item}</li>`).join('\n')
      : '  <li>항목 1</li>\n  <li>항목 2</li>'

    const newText = `<${tag}>\n${listItems}\n</${tag}>`
    const newValue = value.substring(0, start) + newText + value.substring(end)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      const newPosition = start + newText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  return (
    <div className="simple-html-editor">
      {/* 툴바 */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyHeading(1)}
            title="제목 1"
          >
            H1
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyHeading(2)}
            title="제목 2"
          >
            H2
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyHeading(3)}
            title="제목 3"
          >
            H3
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <select
            className="toolbar-select"
            onChange={(e) => {
              if (e.target.value) {
                applyFontSize(e.target.value)
                e.target.value = ''
              }
            }}
            defaultValue=""
            title="글자 크기"
          >
            <option value="" disabled>크기</option>
            <option value="10">10</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
            <option value="28">28</option>
            <option value="32">32</option>
            <option value="36">36</option>
            <option value="48">48</option>
            <option value="72">72</option>
          </select>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyFormat('strong')}
            title="굵게"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyFormat('em')}
            title="기울임"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyFormat('u')}
            title="밑줄"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyFormat('s')}
            title="취소선"
          >
            <s>S</s>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group color-group">
          <div className="color-picker-wrapper">
            <button
              type="button"
              className={`toolbar-btn ${showColorPalette === 'text' ? 'active' : ''}`}
              onClick={() => toggleColorPalette('text')}
              title="글자 색상"
            >
              🎨
            </button>
            {showColorPalette === 'text' && (
              <div className="color-palette">
                {colorPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => applyColorFormat('text', color)}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="color-picker-wrapper">
            <button
              type="button"
              className={`toolbar-btn ${showColorPalette === 'background' ? 'active' : ''}`}
              onClick={() => toggleColorPalette('background')}
              title="배경 색상"
            >
              🖍️
            </button>
            {showColorPalette === 'background' && (
              <div className="color-palette">
                {colorPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => applyColorFormat('background', color)}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyList(false)}
            title="순서 없는 목록"
          >
            • 목록
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyList(true)}
            title="순서 있는 목록"
          >
            1. 목록
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyFormat('link', true)}
            title="링크 추가"
          >
            🔗
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => applyFormat('image', true)}
            title="이미지 추가"
          >
            🖼️
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-btn ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(!showPreview)}
            title="미리보기"
          >
            👁️ {showPreview ? 'HTML' : '미리보기'}
          </button>
        </div>
      </div>

      {/* 에디터 영역 */}
      <div className="editor-content">
        {showPreview ? (
          <div 
            className="editor-preview"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'HTML 내용을 입력하세요...'}
          />
        )}
      </div>
    </div>
  )
}

export default SimpleHtmlEditor
