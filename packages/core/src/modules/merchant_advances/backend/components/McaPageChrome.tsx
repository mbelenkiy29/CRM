"use client"

import * as React from 'react'
import { SetupBanner } from './SetupBanner'
import { GettingStartedTour } from './GettingStartedTour'

export function McaPageChrome() {
  return (
    <>
      <SetupBanner />
      <GettingStartedTour />
    </>
  )
}
