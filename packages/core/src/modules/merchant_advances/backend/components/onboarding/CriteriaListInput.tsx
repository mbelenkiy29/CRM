"use client"

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import { Tag } from '@open-mercato/ui/primitives/tag'
import {
  mergeCriteriaListTokens,
  parseCriteriaListTokens,
  splitCriteriaListCommaDraft,
} from '../../../lib/onboarding/parseListField'

type CriteriaListInputProps = {
  id?: string
  tokens: string[]
  onTokensChange: (tokens: string[]) => void
  placeholder?: string
  removeAriaLabel: string
}

export function CriteriaListInput({
  id,
  tokens,
  onTokensChange,
  placeholder,
  removeAriaLabel,
}: CriteriaListInputProps) {
  const [draft, setDraft] = React.useState('')

  const commitDraft = React.useCallback(() => {
    const parsed = parseCriteriaListTokens(draft)
    if (!parsed.length) {
      setDraft('')
      return
    }
    onTokensChange(mergeCriteriaListTokens(tokens, parsed))
    setDraft('')
  }, [draft, onTokensChange, tokens])

  return (
    <div className="grid gap-2">
      {tokens.length ? (
        <div className="flex flex-wrap gap-1">
          {tokens.map((token) => (
            <Tag
              key={token}
              onRemove={() => onTokensChange(tokens.filter((item) => item !== token))}
              removeAriaLabel={removeAriaLabel}
            >
              {token}
            </Tag>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value
          if (!raw.includes(',')) {
            setDraft(raw)
            return
          }
          const { complete, draft: nextDraft } = splitCriteriaListCommaDraft(raw)
          if (complete.length) onTokensChange(mergeCriteriaListTokens(tokens, complete))
          setDraft(nextDraft)
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitDraft()
          }
        }}
      />
    </div>
  )
}
