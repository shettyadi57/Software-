const CredibilityScore = ({ score }) => {
  const getColor = () => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBadge = () => {
    if (score >= 90) return 'Safe';
    if (score >= 70) return 'Suspicious';
    return 'Violation';
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-400">Credibility:</span>
      <span className={`font-bold ${getColor()}`}>{score}%</span>
      <span className={`text-xs px-2 py-1 rounded-full ${
        score >= 90 ? 'bg-green-500/20 text-green-400' :
        score >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        {getBadge()}
      </span>
    </div>
  );
};

export default CredibilityScore;
