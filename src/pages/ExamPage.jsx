import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questions } from '../data/questions';
import QuestionCard from '../components/QuestionCard';
import Timer from '../components/Timer';
import CredibilityScore from '../components/CredibilityScore';
import MonitoringPanel from '../components/MonitoringPanel';

const ExamPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [credibility, setCredibility] = useState(100);
  const studentEmail = localStorage.getItem('studentEmail') || 'student@demo.edu';

  useEffect(() => {
    const handleViolation = (type) => {
      setCredibility(prev => Math.max(0, prev - (type === 'tab' ? 5 : type === 'multiple' ? 10 : 3)));
    };
    window.addEventListener('violation', handleViolation);
    return () => window.removeEventListener('violation', handleViolation);
  }, []);

  const handleAnswerSelect = (questionId, optionIndex) => {
    setAnswers({ ...answers, [questionId]: optionIndex });
  };

  const handleTimeUp = () => {
    submitExam();
  };

  const submitExam = () => {
    const answeredCount = Object.keys(answers).length;
    navigate('/result', {
      state: {
        totalQuestions: questions.length,
        answered: answeredCount,
        credibilityScore: credibility,
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#050B18] pt-20 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-[#0A1120] rounded-2xl p-4 border border-[#00D1FF]/20 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Exam: Data Structures Test</h2>
            <p className="text-sm text-gray-400">{studentEmail}</p>
          </div>
          <div className="flex items-center space-x-6">
            <Timer initialMinutes={30} onTimeUp={handleTimeUp} />
            <CredibilityScore score={credibility} />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <QuestionCard
              question={questions[currentQuestionIndex]}
              selectedOption={answers[questions[currentQuestionIndex].id]}
              onSelect={handleAnswerSelect}
              index={currentQuestionIndex}
            />
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-6 py-2 bg-[#0A1120] border border-[#00D1FF]/30 rounded-xl disabled:opacity-50 hover:border-[#00D1FF] transition"
              >
                Previous
              </button>
              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={submitExam}
                  className="px-6 py-2 bg-[#00D1FF] text-[#050B18] font-semibold rounded-xl hover:bg-[#00D1FF]/90 transition-all glow"
                >
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-6 py-2 bg-[#0A1120] border border-[#00D1FF]/30 rounded-xl hover:border-[#00D1FF] transition"
                >
                  Next
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#0A1120] rounded-2xl p-4 border border-[#00D1FF]/20">
              <h3 className="font-semibold mb-3">Question Navigator</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                      currentQuestionIndex === idx
                        ? 'bg-[#00D1FF] text-[#050B18]'
                        : answers[q.id] !== undefined
                        ? 'bg-blue-500/30 text-white border border-[#00D1FF]/50'
                        : 'bg-[#050B18] text-gray-400 border border-[#00D1FF]/20 hover:border-[#00D1FF]'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <MonitoringPanel onViolation={(type) => {
              setCredibility(prev => Math.max(0, prev - (type === 'tab' ? 5 : type === 'multiple' ? 10 : 3)));
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPage;
