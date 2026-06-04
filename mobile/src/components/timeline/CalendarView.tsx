import React from 'react';
import { DayPager } from './DayPager';

interface Props {
  initialDateKey?: string;
}

export function CalendarView({ initialDateKey }: Props) {
  return <DayPager initialDateKey={initialDateKey} />;
}
