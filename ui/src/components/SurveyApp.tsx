import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { publicClient } from '../config/viem';
import '../styles/SurveyApp.css';

type AnswerState = 'idle' | 'encrypting' | 'confirming' | 'success' | 'error';

type SurveyQuestion = {
  id: number;
  theme: string;
  prompt: string;
  options: string[];
};

const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const QUESTIONS: SurveyQuestion[] = [
  {
    id: 0,
    theme: 'Zama Focus',
    prompt: 'What is Zama best known for in web3 today?',
    options: ['Fully Homomorphic Encryption (FHE)', 'Layer-2 bridging', 'NFT marketplaces'],
  },
  {
    id: 1,
    theme: 'FHE Fundamentals',
    prompt: 'Which statement best describes FHE?',
    options: [
      'It allows computation on encrypted data without decryption',
      'It hides block timestamps from validators',
      'It stores private keys on-chain',
      'It compresses calldata for cheaper gas',
    ],
  },
  {
    id: 2,
    theme: 'Network',
    prompt: 'Which network does this FHEVM demo target?',
    options: ['Ethereum Sepolia', 'Polygon mainnet', 'Base Sepolia'],
  },
  {
    id: 3,
    theme: 'Relayer',
    prompt: 'What does the Relayer SDK handle for users?',
    options: ['Ciphertext registration and proofs', 'Gas fee refunds', 'Token swaps'],
  },
  {
    id: 4,
    theme: 'Privacy',
    prompt: 'Which part of the survey stays encrypted on-chain?',
    options: ['Each selected answer', 'Only the question text', 'The wallet address'],
  },
];

export function SurveyApp() {
  const { address, chainId } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>(
    () => QUESTIONS.map(() => null),
  );
  const [answerStates, setAnswerStates] = useState<AnswerState[]>(
    () => QUESTIONS.map(() => 'idle'),
  );
  const [answered, setAnswered] = useState<boolean[]>(() => QUESTIONS.map(() => false));
  const [isPublic, setIsPublic] = useState<boolean[]>(() => QUESTIONS.map(() => false));
  const [results, setResults] = useState<(number[] | null)[]>(() => QUESTIONS.map(() => null));
  const [resultsLoading, setResultsLoading] = useState<boolean[]>(() => QUESTIONS.map(() => false));
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const isContractConfigured = true;

  const answeredCount = useMemo(
    () => answered.filter(Boolean).length,
    [answered],
  );

  const refreshStatus = useCallback(async () => {
    if (!address || !isContractConfigured) {
      setAnswered(QUESTIONS.map(() => false));
      setIsPublic(QUESTIONS.map(() => false));
      setResults(QUESTIONS.map(() => null));
      return;
    }

    const walletAddress = address as `0x${string}`;
    setStatusLoading(true);
    setStatusError(null);

    try {
      const answeredStates = await Promise.all(
        QUESTIONS.map((question) =>
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'hasAnswered',
            args: [walletAddress, question.id],
          }),
        ),
      );

      const publicStates = await Promise.all(
        QUESTIONS.map((question) =>
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'isQuestionPublic',
            args: [question.id],
          }),
        ),
      );

      setAnswered(answeredStates as boolean[]);
      setIsPublic(publicStates as boolean[]);
    } catch (error) {
      console.error('Failed to load survey status', error);
      setStatusError('Failed to refresh on-chain status.');
    } finally {
      setStatusLoading(false);
    }
  }, [address, isContractConfigured]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const submitAnswer = useCallback(
    async (questionId: number) => {
      const selected = selectedOptions[questionId];

      if (selected === null) {
        setAnswerStates((prev) => {
          const next = [...prev];
          next[questionId] = 'error';
          return next;
        });
        return;
      }

      if (!address || !instance || !signerPromise) {
        return;
      }

      setAnswerStates((prev) => {
        const next = [...prev];
        next[questionId] = 'encrypting';
        return next;
      });

      try {
        const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
        input.add32(selected);
        const encrypted = await input.encrypt();

        const signer = await signerPromise;
        if (!signer) {
          throw new Error('Wallet signer not available');
        }

        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setAnswerStates((prev) => {
          const next = [...prev];
          next[questionId] = 'confirming';
          return next;
        });

        const tx = await contract.submitAnswer(
          questionId,
          encrypted.handles[0],
          encrypted.inputProof,
        );
        await tx.wait();

        setAnswerStates((prev) => {
          const next = [...prev];
          next[questionId] = 'success';
          return next;
        });

        setAnswered((prev) => {
          const next = [...prev];
          next[questionId] = true;
          return next;
        });

        refreshStatus();
      } catch (error) {
        console.error('Submit answer failed', error);
        setAnswerStates((prev) => {
          const next = [...prev];
          next[questionId] = 'error';
          return next;
        });
      }
    },
    [address, instance, selectedOptions, signerPromise, refreshStatus],
  );

  const makeResultsPublic = useCallback(
    async (questionId: number) => {
      if (!signerPromise) {
        return;
      }

      try {
        const signer = await signerPromise;
        if (!signer) {
          throw new Error('Wallet signer not available');
        }

        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.makeResultsPublic(questionId);
        await tx.wait();

        setIsPublic((prev) => {
          const next = [...prev];
          next[questionId] = true;
          return next;
        });

        refreshStatus();
      } catch (error) {
        console.error('Make results public failed', error);
      }
    },
    [signerPromise, refreshStatus],
  );

  const revealResults = useCallback(
    async (questionId: number) => {
      if (!instance) {
        return;
      }

      setResultsLoading((prev) => {
        const next = [...prev];
        next[questionId] = true;
        return next;
      });

      try {
        const encryptedCounts = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getEncryptedCounts',
          args: [questionId],
        });

        const optionCount = QUESTIONS[questionId].options.length;
        const handles = Array.from(encryptedCounts).slice(0, optionCount);
        const decryptTargets = handles.filter((handle) => handle !== ZERO_HANDLE);

        let clearValues: Record<string, bigint> = {};
        if (decryptTargets.length > 0) {
          const decrypted = await instance.publicDecrypt(decryptTargets);
          clearValues = decrypted.clearValues as Record<string, bigint>;
        }

        const counts = handles.map((handle) =>
          handle === ZERO_HANDLE ? 0 : Number(clearValues[handle] ?? 0n),
        );

        setResults((prev) => {
          const next = [...prev];
          next[questionId] = counts;
          return next;
        });
      } catch (error) {
        console.error('Decrypt results failed', error);
      } finally {
        setResultsLoading((prev) => {
          const next = [...prev];
          next[questionId] = false;
          return next;
        });
      }
    },
    [instance],
  );

  return (
    <div className="survey-app">
      <Header />
      <section className="survey-hero">
        <div className="survey-hero-content">
          <p className="hero-eyebrow">Encrypted insights</p>
          <h2 className="hero-title">Zama Confidential Poll</h2>
          <p className="hero-subtitle">
            Every answer is encrypted with FHE before hitting the chain. Results only become
            public when you request them question by question.
          </p>
        </div>
        <div className="survey-hero-stats">
          <div className="stat-card">
            <span className="stat-label">Questions</span>
            <span className="stat-value">{QUESTIONS.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Answered</span>
            <span className="stat-value">{answeredCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Chain</span>
            <span className="stat-value">Sepolia</span>
          </div>
        </div>
      </section>

      <section className="survey-status">
        {!isContractConfigured && (
          <div className="status-banner warning">
            <span>Contract address not set. Update ui/src/config/contracts.ts after deployment.</span>
          </div>
        )}
        {chainId && chainId !== 11155111 && (
          <div className="status-banner warning">
            <span>Switch your wallet to Sepolia to submit encrypted answers.</span>
          </div>
        )}
        {zamaLoading && (
          <div className="status-banner">
            <span>Initializing Zama encryption service...</span>
          </div>
        )}
        {zamaError && (
          <div className="status-banner error">
            <span>{zamaError}</span>
          </div>
        )}
        {statusError && (
          <div className="status-banner error">
            <span>{statusError}</span>
          </div>
        )}
        {!address && (
          <div className="status-banner">
            <span>Connect your wallet to participate in the encrypted survey.</span>
          </div>
        )}
        {address && (
          <div className="status-actions">
            <button
              className="secondary-button"
              onClick={refreshStatus}
              disabled={statusLoading}
            >
              {statusLoading ? 'Refreshing...' : 'Refresh on-chain status'}
            </button>
          </div>
        )}
      </section>

      <section className="survey-grid">
        {QUESTIONS.map((question, index) => {
          const selected = selectedOptions[question.id];
          const state = answerStates[question.id];
          const isAnswered = answered[question.id];
          const publicReady = isPublic[question.id];
          const result = results[question.id];

          return (
            <div
              key={question.id}
              className="question-card"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="question-header">
                <div>
                  <p className="question-theme">{question.theme}</p>
                  <h3 className="question-title">{question.prompt}</h3>
                </div>
                <span className="question-index">0{question.id + 1}</span>
              </div>

              <div className="question-options">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={option}
                    className={`option-pill ${selected === optionIndex ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedOptions((prev) => {
                        const next = [...prev];
                        next[question.id] = optionIndex;
                        return next;
                      });
                      setAnswerStates((prev) => {
                        const next = [...prev];
                        next[question.id] = 'idle';
                        return next;
                      });
                    }}
                    disabled={!address || isAnswered}
                  >
                    <span className="option-index">{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="option-label">{option}</span>
                  </button>
                ))}
              </div>

              <div className="question-actions">
                <button
                  className="primary-button"
                  onClick={() => submitAnswer(question.id)}
                  disabled={
                    !address ||
                    !instance ||
                    !signerPromise ||
                    isAnswered ||
                    (chainId !== undefined && chainId !== 11155111) ||
                    state === 'encrypting' ||
                    state === 'confirming' ||
                    !isContractConfigured
                  }
                >
                  {isAnswered
                    ? 'Answer submitted'
                    : state === 'encrypting'
                    ? 'Encrypting...'
                    : state === 'confirming'
                    ? 'Confirming...'
                    : 'Submit encrypted answer'}
                </button>
                {state === 'error' && (
                  <span className="helper-text">Select an option and try again.</span>
                )}
              </div>

              <div className="question-results">
                <div className="results-header">
                  <div>
                    <p className="results-label">Results status</p>
                    <p className="results-value">{publicReady ? 'Public' : 'Encrypted'}</p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => makeResultsPublic(question.id)}
                    disabled={
                      !address ||
                      publicReady ||
                      !signerPromise ||
                      !isContractConfigured ||
                      (chainId !== undefined && chainId !== 11155111)
                    }
                  >
                    {publicReady ? 'Already public' : 'Make results public'}
                  </button>
                </div>

                <div className="results-body">
                  <button
                    className="ghost-button"
                    onClick={() => revealResults(question.id)}
                    disabled={!publicReady || resultsLoading[question.id] || !instance}
                  >
                    {resultsLoading[question.id] ? 'Decrypting...' : 'Reveal counts'}
                  </button>

                  {result && (
                    <div className="results-grid">
                      {question.options.map((option, optionIndex) => (
                        <div key={option} className="result-row">
                          <span className="result-option">{option}</span>
                          <span className="result-count">{result[optionIndex] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!result && (
                    <p className="helper-text">
                      {publicReady
                        ? 'Decrypt counts to view results.'
                        : 'Results stay encrypted until you request them.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="survey-footer">
        <div className="footer-card">
          <h3>How it works</h3>
          <p>
            Each submission encrypts your choice with Zama&apos;s FHEVM before it reaches the
            contract. Counts stay encrypted until someone explicitly makes a question public.
          </p>
        </div>
        <div className="footer-card">
          <h3>Why it matters</h3>
          <p>
            You can collect sensitive feedback while keeping every participant private. Only
            the aggregated results are revealed, and only on demand.
          </p>
        </div>
      </section>
    </div>
  );
}
