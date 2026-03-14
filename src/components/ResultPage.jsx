import { useLocation, Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const ResultPage = () => {
  const location = useLocation();
  const { totalQuestions, answered, credibilityScore } = location.state || {
    totalQuestions: 30,
    answered: 30,
    credibilityScore: 92,
  };
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Credibility', 'Loss'],
          datasets: [{
            data: [credibilityScore, 100 - credibilityScore],
            backgroundColor: ['#00D1FF', '#1E293B'],
            borderWidth: 0,
          }]
        },
        options: {
          cutout: '70%',
          plugins: { tooltip: { enabled: false } }
        }
      });
    }
  }, [credibilityScore]);

  return (
    <div className="min-h-screen bg-[#050B18] flex items-center justify-center px-4">
      <div className="bg-[#0A1120] rounded-2xl p-8 border border-[#00D1FF]/20 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Exam Submitted <span className="text-[#00D1FF]">Successfully</span></h1>
        <div className="space-y-4 mb-6">
          <div className="flex justify-between text-gray-300">
            <span>Total Questions:</span>
            <span className="font-semibold">{totalQuestions}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Answered:</span>
            <span className="font-semibold">{answered}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Credibility Score:</span>
            <span className="font-semibold text-[#00D1FF]">{credibilityScore}%</span>
          </div>
        </div>
        <div className="w-48 h-48 mx-auto mb-6">
          <canvas ref={chartRef}></canvas>
        </div>
        <div className="bg-[#00D1FF]/20 border border-[#00D1FF] rounded-xl p-4 mb-6">
          <p className="text-lg">Exam Integrity: <span className="font-bold text-[#00D1FF]">HIGH</span></p>
        </div>
        <Link to="/" className="inline-block py-3 px-6 bg-[#00D1FF] text-[#050B18] font-semibold rounded-xl hover:bg-[#00D1FF]/90 transition-all glow">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default ResultPage;
