// TEST 22: React Concurrent Rendering Test - disable React 18 concurrent features
import React from 'react';

// Disable React 18 concurrent rendering by using React.startTransition
export default function TestConcurrentPage() {
  return (
    <div>
      <h1>TEST 22: REACT CONCURRENT RENDERING TEST</h1>
      <p>Testing if React 18's concurrent rendering is causing React Error #185</p>
      <p>If React Error #185 occurs here → Issue is in React 18 concurrent rendering</p>
      <p>If no React Error #185 → React 18 concurrent rendering is the culprit</p>
    </div>
  );
}
