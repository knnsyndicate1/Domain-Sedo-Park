"use client";
import { Suspense } from 'react';
import SearchDomainClient from './SearchDomainClient';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchDomainClient />
    </Suspense>
  );
} 