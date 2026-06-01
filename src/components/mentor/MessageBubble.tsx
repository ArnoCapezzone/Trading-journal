import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../lib/mentorClient';

interface Props {
  message: Message;
  streaming?: boolean;
}

export default function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '16px 0',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: '"JetBrains Mono", monospace',
          background: isUser
            ? 'linear-gradient(135deg, #252D3F, #1A2235)'
            : 'linear-gradient(135deg, #3D8EF0, #5AA0F5)',
          color: isUser ? 'var(--text-tertiary)' : '#fff',
          boxShadow: isUser ? 'none' : '0 1px 6px rgba(61,142,240,0.35)',
        }}
      >
        {isUser ? 'YOU' : 'AI'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}
        >
          {isUser ? 'You' : 'Mentor'}
        </div>

        {isUser ? (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>
        ) : (
          <div
            className="tj-md"
            style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.7,
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (streaming ? '▍' : '')}
            </ReactMarkdown>
            {streaming && message.content && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 14,
                  backgroundColor: '#3D8EF0',
                  marginLeft: 2,
                  animation: 'mentorCursor 1s steps(2) infinite',
                  verticalAlign: 'text-bottom',
                }}
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes mentorCursor { 50% { opacity: 0; } }
        .tj-md h1, .tj-md h2, .tj-md h3 {
          color: #EEF0F6;
          margin: 18px 0 8px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .tj-md h1 { font-size: 17px; }
        .tj-md h2 { font-size: 15px; }
        .tj-md h3 { font-size: 13px; color: #3D8EF0; text-transform: uppercase; letter-spacing: 0.06em; }
        .tj-md p { margin: 8px 0; }
        .tj-md strong { color: #fff; font-weight: 600; }
        .tj-md em { color: #8E97AC; }
        .tj-md ul, .tj-md ol { margin: 8px 0; padding-left: 22px; }
        .tj-md li { margin: 4px 0; }
        .tj-md code {
          background: #181E2C;
          padding: 1px 6px;
          border-radius: 4px;
          font-family: "JetBrains Mono", monospace;
          font-size: 11.5px;
          color: #5AA0F5;
        }
        .tj-md pre {
          background: #0A0D14;
          border: 1px solid var(--border-soft);
          border-radius: 7px;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 12px 0;
        }
        .tj-md pre code {
          background: transparent;
          padding: 0;
          color: #C8CDD8;
          font-size: 11.5px;
        }
        .tj-md table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
          font-size: 12px;
        }
        .tj-md th, .tj-md td {
          border: 1px solid var(--border-default);
          padding: 6px 10px;
          text-align: left;
        }
        .tj-md th { background: #0D1017; color: #8E97AC; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .tj-md blockquote {
          border-left: 3px solid #3D8EF0;
          padding-left: 12px;
          margin: 10px 0;
          color: #8E97AC;
          font-style: italic;
        }
        .tj-md hr { border: none; border-top: 1px solid var(--border-default); margin: 16px 0; }
        .tj-md a { color: #3D8EF0; text-decoration: none; }
        .tj-md a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
