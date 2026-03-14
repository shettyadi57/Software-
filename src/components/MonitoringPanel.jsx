import { useState, useEffect } from 'react';

const MonitoringPanel = ({ onViolation }) => {
  const [violations, setViolations] = useState([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(true);
  const [multiplePersons, setMultiplePersons] = useState(false);
  const [copyAttempts, setCopyAttempts] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const event = Math.random();
      if (event < 0.1) {
        setTabSwitchCount(prev => prev + 1);
        setViolations(prev => [...prev, 'Tab switch detected']);
        onViolation && onViolation('tab');
      }
      if (event < 0.05) {
        setMultiplePersons(true);
        setViolations(prev => [...prev, 'Multiple persons detected']);
        onViolation && onViolation('multiple');
      }
      if (event < 0.08) {
        setCopyAttempts(prev => prev + 1);
        setViolations(prev => [...prev, 'Copy attempt detected']);
        onViolation && onViolation('copy');
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [onViolation]);

  return (
    <div className="bg-[#0A1120] rounded-xl p-4 border border-[#00D1FF]/20">
      <h3 className="text-lg font-semibold mb-3 flex items-center">
        <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
        AI Monitoring Active
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Tab Switching:</span>
          <span className={tabSwitchCount > 0 ? 'text-red-400' : 'text-green-400'}>
            {tabSwitchCount} {tabSwitchCount > 0 ? '⚠️' : '✓'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Face Presence:</span>
          <span className={faceDetected ? 'text-green-400' : 'text-red-400'}>
            {faceDetected ? 'Active' : 'Lost'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Multiple Persons:</span>
          <span className={multiplePersons ? 'text-red-400' : 'text-green-400'}>
            {multiplePersons ? 'Detected' : 'None'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Copy Monitoring:</span>
          <span className={copyAttempts > 0 ? 'text-red-400' : 'text-green-400'}>
            {copyAttempts} attempts
          </span>
        </div>
      </div>
      {violations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#00D1FF]/20">
          <p className="text-xs text-gray-400 mb-1">Recent violations:</p>
          {violations.slice(-3).map((v, i) => (
            <p key={i} className="text-xs text-red-400">• {v}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonitoringPanel;
