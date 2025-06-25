import React, { useState, useEffect, useCallback, useRef } from 'react';
import MorseUI from './MorseUI';
import { MorseRunnerController } from './MorseRunnerController';
import { morseAudio } from './MorseAudio';
import { filterNoise } from './FilterNoiseGenerator';
import { MorseSequences, SEQUENCE_PRESETS } from './MorseSequences';
import { MorseSettings } from './MorseSettings';
import { useCustomAlphabet } from './CustomAlphabetManager';
import { PerformanceDataManager } from './PerformanceDataManager';
import { AlphaBanner } from './AlphaBanner';
import { SettingsButton } from './SettingsButton';
import { SharedSettingsPanel } from './SharedSettingsPanel';
import { CONTEST_TYPES } from './ContestExchange';

const MorseTrainer = () => {
  const morseRef = useRef(new MorseSequences());
  const {
    customSequence,
    isModalOpen,
    setIsModalOpen,
    saveCustomSequence,
    CustomAlphabetModal
  } = useCustomAlphabet();

  const loadSettings = () => {
    const settings = MorseSettings.load();
    return {
      currentLevel: settings.currentLevel,
      wpm: settings.wpm,
      frequency: settings.frequency,
      groupSize: settings.groupSize,
      minGroupSize: settings.minGroupSize || 1, // Minimum group size
      maxRepeats: settings.maxRepeats !== undefined ? settings.maxRepeats : -1, // Max repeats
      advanceThreshold: settings.advanceThreshold,
      headCopyMode: settings.headCopyMode,
      hideChars: settings.hideChars,
      qsbAmount: settings.qsbAmount || 0,
      currentPresetId: settings.currentPresetId || 'koch',
      progressiveSpeedMode: settings.progressiveSpeedMode || false,
      levelSpacing: settings.levelSpacing || 1000,
      transitionDelay: settings.transitionDelay || 500,
      // Filter noise settings
      radioNoiseEnabled: settings.radioNoiseEnabled || false,
      radioNoiseVolume: settings.radioNoiseVolume || 0.5,
      radioNoiseResonance: settings.radioNoiseResonance || 25,
      radioNoiseWarmth: settings.radioNoiseWarmth || 8,
      radioNoiseDrift: settings.radioNoiseDrift || 0.5,
      radioNoiseAtmospheric: settings.radioNoiseAtmospheric || 0.5,
      radioNoiseCrackle: settings.radioNoiseCrackle || 0.05,
      farnsworthSpacing: settings.farnsworthSpacing || 0,
      filterBandwidth: settings.filterBandwidth || 550,
      infiniteDelayEnabled: settings.infiniteDelayEnabled || false,
      // New settings for level threshold and lock
      minLevelThreshold: settings.minLevelThreshold || 1,
      isLevelLocked: settings.isLevelLocked || false,
      // Runner mode settings
      qsoRate: settings.qsoRate || 3,
      sendDelay: settings.sendDelay || 0.5,
      showExchangePreview: settings.showExchangePreview !== undefined ? settings.showExchangePreview : true,
      contestTypeId: settings.contestTypeId || 'sprint',
      // New setting for mode
      activeModeTab: settings.activeModeTab || 'trainer'
    };
  };

  const savedSettings = loadSettings();

  // Shared state between both modes
  const [currentLevel, setCurrentLevel] = useState(savedSettings.currentLevel);
  const [wpm, setWpm] = useState(savedSettings.wpm);
  const [frequency, setFrequency] = useState(savedSettings.frequency);
  const [farnsworthSpacing, setFarnsworthSpacing] = useState(savedSettings.farnsworthSpacing || 0);
  const [qsbAmount, setQsbAmount] = useState(savedSettings.qsbAmount || 0);
  const [levelSpacing, setLevelSpacing] = useState(savedSettings.levelSpacing);
  const [transitionDelay, setTransitionDelay] = useState(savedSettings.transitionDelay);

  // Filter noise state (shared)
  const [radioNoiseEnabled, setRadioNoiseEnabled] = useState(savedSettings.radioNoiseEnabled);
  const [radioNoiseVolume, setRadioNoiseVolume] = useState(savedSettings.radioNoiseVolume);
  const [radioNoiseResonance, setRadioNoiseResonance] = useState(savedSettings.radioNoiseResonance);
  const [radioNoiseWarmth, setRadioNoiseWarmth] = useState(savedSettings.radioNoiseWarmth);
  const [radioNoiseDrift, setRadioNoiseDrift] = useState(savedSettings.radioNoiseDrift);
  const [radioNoiseAtmospheric, setRadioNoiseAtmospheric] = useState(savedSettings.radioNoiseAtmospheric);
  const [radioNoiseCrackle, setRadioNoiseCrackle] = useState(savedSettings.radioNoiseCrackle);
  const [filterBandwidth, setFilterBandwidth] = useState(savedSettings.filterBandwidth || 550);

  // Trainer-specific state
  const [groupSize, setGroupSize] = useState(savedSettings.groupSize);
  const [minGroupSize, setMinGroupSize] = useState(savedSettings.minGroupSize);
  const [maxRepeats, setMaxRepeats] = useState(savedSettings.maxRepeats);
  const [advanceThreshold, setAdvanceThreshold] = useState(savedSettings.advanceThreshold);
  const [headCopyMode, setHeadCopyMode] = useState(savedSettings.headCopyMode);
  const [hideChars, setHideChars] = useState(savedSettings.hideChars);
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentPreset, setCurrentPreset] = useState(morseRef.current.getCurrentPreset());
  const [progressiveSpeedMode, setProgressiveSpeedMode] = useState(savedSettings.progressiveSpeedMode);
  const [infiniteDelayEnabled, setInfiniteDelayEnabled] = useState(savedSettings.infiniteDelayEnabled || false);
  const [currentGroupSize, setCurrentGroupSize] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [currentGroup, setCurrentGroup] = useState('');
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [history, setHistory] = useState([]);
  const [performanceData, setPerformanceData] = useState(() => {
    if (typeof window !== 'undefined') {
      return PerformanceDataManager.load();
    }
    return [];
  });
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notification, setNotification] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  // New level lock settings
  const [minLevelThreshold, setMinLevelThreshold] = useState(savedSettings.minLevelThreshold || 1);
  const [isLevelLocked, setIsLevelLocked] = useState(savedSettings.isLevelLocked || false);

  // Runner-specific state
  const [qsoRate, setQsoRate] = useState(savedSettings.qsoRate || 3);
  const [sendDelay, setSendDelay] = useState(savedSettings.sendDelay || 0.5);
  const [showExchangePreview, setShowExchangePreview] = useState(
    savedSettings.showExchangePreview !== undefined ? savedSettings.showExchangePreview : true
  );
  const [contestType, setContestType] = useState(
    CONTEST_TYPES[savedSettings.contestTypeId] || CONTEST_TYPES.SPRINT
  );

  // New setting for active mode tab
  const [activeModeTab, setActiveModeTab] = useState(savedSettings.activeModeTab || 'trainer');

  // Settings panel state
  const [isSettingsPanelVisible, setIsSettingsPanelVisible] = useState(false);

  const notificationTimeoutRef = useRef(null);

  // First, define the showNotification function
  const showNotification = useCallback((message, color = 'blue', duration = 2000) => {
    // First clear any existing notification to avoid overlap
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }

    // Set the new notification
    setNotification({ message, color });

    // For waiting notifications in infinite delay mode, don't auto-dismiss
    const isWaitingNotification = message.includes('waiting for your answer') && infiniteDelayEnabled;
    
    if (!isWaitingNotification) {
      // Schedule its removal after duration for regular notifications
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
        notificationTimeoutRef.current = null;
      }, duration);
    }
    // For waiting notifications, we'll clear them when the user submits their answer
  }, [infiniteDelayEnabled]);

  // Then define updatePerformanceData function
  const updatePerformanceData = useCallback((isCorrect, level) => {
    setPerformanceData(prev => {
      const newData = [...prev];
      const timestamp = new Date().getTime();

      // Calculate rolling accuracy from the last 10 attempts
      // Use previous data if available, otherwise just the new entry
      const lastTenAttempts = newData.slice(-9).concat([{ isCorrect }]);
      const rollingAccuracy = lastTenAttempts.reduce((acc, curr) =>
        acc + (curr.isCorrect ? 1 : 0), 0) / lastTenAttempts.length * 100;

      newData.push({
        timestamp,
        attempt: newData.length + 1,
        isCorrect,
        rollingAccuracy: Math.round(rollingAccuracy),
        level,
      });

      // Keep only the last 100 entries
      return newData.slice(-100);
    });
  }, []);

  // Define startNewGroup first as it's referenced by handleMaxRepeatsReached
  const startNewGroup = useCallback((level, delay = null) => {
    const start = () => {
      // Generate new group with proper size constraints
      let newGroup = morseRef.current.generateGroup(level, groupSize, minGroupSize);

      setCurrentGroup(newGroup);
      setCurrentGroupSize(newGroup.length);
      setUserInput('');
      setShowAnswer(false);
      setIsPlaying(true);

      // Reset the repeat count when starting a new group
      if (morseAudio.resetRepeatCount) {
        morseAudio.resetRepeatCount();
      }

      morseAudio.start();
      morseAudio.playSequence(newGroup, wpm, farnsworthSpacing, levelSpacing);

      // Start filter noise if enabled
      if (radioNoiseEnabled) {
        // Ensure the filter noise has the latest Morse volume reference
        filterNoise.setMorseAudioVolume(morseAudio.getCurrentVolume());
        filterNoise.start();
      }
    };

    if (delay !== null) {
      setTimeout(start, delay);
    } else {
      start();
    }
  }, [groupSize, minGroupSize, wpm, farnsworthSpacing, levelSpacing, radioNoiseEnabled]);

  // Handler for when max repeats is reached
  const handleMaxRepeatsReached = useCallback(() => {
    if (!isPlaying) return;

    // Stop the audio
    morseAudio.stop();
    if (radioNoiseEnabled) filterNoise.stop();

    // If infinite delay is enabled, don't mark as incorrect but pause for user input
    if (infiniteDelayEnabled) {
      showNotification(`Max repeats (${maxRepeats}) reached - waiting for your answer`, 'yellow', 10000); // Longer duration
      // Keep isPlaying true but put system in a "waiting" state
      // The user can still type their answer
      return;
    }

    // Otherwise, proceed with the original behavior - mark as incorrect
    setIsPlaying(false);
    const emptyInput = "";

    updatePerformanceData(false, currentLevel);
    setScore(prev => ({ ...prev, wrong: prev.wrong + 1 }));
    setHistory(prev => [...prev, { group: currentGroup, userInput: emptyInput, correct: false }]);
    setConsecutiveCorrect(0);

    const notificationDuration = Math.min(1500, transitionDelay - 200);
    showNotification(`Max repeats (${maxRepeats}) reached - marked incorrect`, 'red', notificationDuration);

    setTimeout(() => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        setNotification(null);
        notificationTimeoutRef.current = null;
      }
      startNewGroup(currentLevel);
    }, transitionDelay);
  }, [
    isPlaying, radioNoiseEnabled, currentLevel, currentGroup,
    maxRepeats, transitionDelay, showNotification,
    updatePerformanceData, startNewGroup, infiniteDelayEnabled
  ]);

  useEffect(() => {
    morseAudio.initialize();
    setCurrentPreset(morseRef.current.getCurrentPreset());

    // Add resetRepeatCount method to morseAudio if it doesn't exist
    if (!morseAudio.resetRepeatCount) {
      morseAudio.resetRepeatCount = function() {
        this.repeatCount = 0;
      };
    }

    if (customSequence) {
      morseRef.current.updateCustomSequence(customSequence);
    }

    return () => {
      morseAudio.cleanup();
      filterNoise.cleanup(); // Clean up filter noise when component unmounts
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [customSequence]);

  // Set max repeats callback in Morse Audio
  useEffect(() => {
    morseAudio.setMaxRepeats(maxRepeats, handleMaxRepeatsReached);
  }, [maxRepeats, handleMaxRepeatsReached]);

  // Save performance data to cookies whenever it changes
  useEffect(() => {
    if (performanceData.length > 0) {
      PerformanceDataManager.save(performanceData);
    }
  }, [performanceData]);

  useEffect(() => {
    // Update the filter noise frequency to match the Morse tone
    if (radioNoiseEnabled) {
      filterNoise.syncFrequency(frequency);
    }
  }, [frequency, radioNoiseEnabled]);

  // Sync Morse audio volume with filter noise
  useEffect(() => {
    // When morseAudio's volume changes, update the reference in filterNoise
    filterNoise.setMorseAudioVolume(morseAudio.getCurrentVolume());
  }, [isPlaying]); // Add any other dependencies that might affect Morse volume

  useEffect(() => {
    // Start or stop the filter noise based on the enabled state
    if (radioNoiseEnabled && isPlaying) {
      filterNoise.start();
    } else {
      filterNoise.stop();
    }
  }, [radioNoiseEnabled, isPlaying]);

  // Save all settings to localStorage
  useEffect(() => {
    MorseSettings.save({
      currentLevel,
      wpm,
      frequency,
      farnsworthSpacing,
      groupSize,
      minGroupSize,
      maxRepeats,
      advanceThreshold,
      headCopyMode,
      hideChars,
      qsbAmount,
      currentPresetId: currentPreset?.id,
      progressiveSpeedMode,
      levelSpacing,
      transitionDelay,
      // Include filter noise settings
      radioNoiseEnabled,
      radioNoiseVolume,
      radioNoiseResonance,
      radioNoiseWarmth,
      radioNoiseDrift,
      radioNoiseAtmospheric,
      radioNoiseCrackle,
      filterBandwidth,
      infiniteDelayEnabled,
      // Include new level lock settings
      minLevelThreshold,
      isLevelLocked,
      // Runner-specific settings
      qsoRate,
      sendDelay,
      showExchangePreview,
      contestTypeId: contestType?.id || 'sprint',
      // Save active mode tab
      activeModeTab
    });
  }, [
    currentLevel, wpm, frequency, farnsworthSpacing, groupSize, minGroupSize, maxRepeats,
    advanceThreshold, headCopyMode, hideChars, qsbAmount, currentPreset, progressiveSpeedMode,
    levelSpacing, transitionDelay, activeModeTab,
    // Include filter noise settings
    radioNoiseEnabled, radioNoiseVolume, radioNoiseResonance, radioNoiseWarmth,
    radioNoiseDrift, radioNoiseAtmospheric, radioNoiseCrackle, filterBandwidth,
    // Include new level lock settings
    minLevelThreshold, isLevelLocked,
    // Runner settings
    qsoRate, sendDelay, showExchangePreview, contestType
  ]);

  const handleInfiniteDelayToggle = () => {
    setInfiniteDelayEnabled(prev => !prev);
  };

  const handleProgressiveSpeedToggle = useCallback(() => {
    setProgressiveSpeedMode(prev => !prev);
  }, []);

  // Handler for minimum level threshold changes
  const handleMinLevelThresholdChange = (delta) => {
    const newThreshold = Math.max(1, Math.min(currentLevel, minLevelThreshold + delta));
    setMinLevelThreshold(newThreshold);
  };

  // Handler for level lock toggle
  const handleLevelLockToggle = () => {
    setIsLevelLocked(!isLevelLocked);
    showNotification(
      !isLevelLocked
        ? `Level locked at ${currentLevel}`
        : 'Level unlocked',
      !isLevelLocked ? 'yellow' : 'blue',
      1500
    );
  };

  const updateLevelAndSpeed = useCallback((newLevel, isAutomatic = false) => {
    // If level is locked and this is an automatic level change, don't update
    if (isLevelLocked && isAutomatic) {
      showNotification('Level locked - not advancing', 'yellow', transitionDelay);
      return;
    }

    // Ensure the level doesn't drop below the minimum threshold
    const adjustedLevel = Math.max(minLevelThreshold, newLevel);
    setCurrentLevel(adjustedLevel);

    if (progressiveSpeedMode && isAutomatic) {
      const speedDelta = adjustedLevel > currentLevel ? 1 : -1;
      const newWpm = Math.max(5, Math.min(50, wpm + speedDelta));
      setWpm(newWpm);

      if (isPlaying) {
        morseAudio.stop();
        if (radioNoiseEnabled) filterNoise.stop();
        showNotification(
          `Level ${adjustedLevel}: Speed ${speedDelta > 0 ? 'increased' : 'decreased'} to ${newWpm} WPM`,
          speedDelta > 0 ? 'green' : 'yellow',
          transitionDelay
        );
        startNewGroup(adjustedLevel, transitionDelay);
      }
    } else {
      if (isPlaying) {
        morseAudio.stop();
        if (radioNoiseEnabled) filterNoise.stop();
        showNotification(`Level changed to ${adjustedLevel}`, 'yellow', transitionDelay);
        startNewGroup(adjustedLevel, transitionDelay);
      }
    }
  }, [progressiveSpeedMode, wpm, currentLevel, isPlaying, startNewGroup, showNotification,
      transitionDelay, radioNoiseEnabled, minLevelThreshold, isLevelLocked]);

  // Filter bandwidth handler
  const handleFilterBandwidthChange = (delta) => {
    const newValue = Math.max(50, Math.min(800, filterBandwidth + delta));
    setFilterBandwidth(newValue);
    filterNoise.updateParameter('filterBandwidth', newValue);
  };

  const handleLevelChange = (delta) => {
    // If level is locked, don't allow any changes
    if (isLevelLocked) {
      showNotification('Level is locked', 'yellow', 1500);
      return;
    }

    // Calculate the new level, ensuring it doesn't go below minLevelThreshold
    const newLevel = Math.max(
      minLevelThreshold,
      Math.min(morseRef.current.getMaxLevel(), currentLevel + delta)
    );

    if (newLevel !== currentLevel) {
      updateLevelAndSpeed(newLevel, false);
    }
  };

  const handleLevelSpacingChange = (delta) => {
    const step = 500;
    const min = step;  // 500ms minimum
    const max = 5000;  // 5000ms maximum
    const newSpacing = Math.max(min, Math.min(max, levelSpacing + delta));
    setLevelSpacing(newSpacing);
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(currentLevel, transitionDelay);
    }
  };

  const handleTransitionDelayChange = (delta) => {
    const step = 100;
    const min = 200;   // 200ms minimum
    const max = 2000;  // 2000ms maximum
    const newDelay = Math.max(min, Math.min(max, transitionDelay + delta));
    setTransitionDelay(newDelay);
  };

  const handleCharacterInput = useCallback((char) => {
    // Allow input if we're in infinite delay mode, even with a notification
    const isInfiniteDelayWaiting = infiniteDelayEnabled && isPlaying && notification?.message?.includes('waiting for your answer');
    
    if ((!isPlaying || (notification && !isInfiniteDelayWaiting))) return;

    if (char === '\u232B') {
      handleCharacterRemoved();
      return;
    }

    const newInput = userInput + char;
    setUserInput(newInput);

    // Clear the waiting notification if we're in infinite delay mode
    if (isInfiniteDelayWaiting && notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
      setNotification(null);
    }

    const handleWrong = () => {
      setScore(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      setHistory(prev => [...prev, { group: currentGroup, userInput: newInput, correct: false }]);
      setConsecutiveCorrect(0);
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      setIsPlaying(false);

      // Only decrease level if not level-locked and above minimum threshold
      if (currentLevel > minLevelThreshold && !isLevelLocked) {
        updateLevelAndSpeed(currentLevel - 1, true);
      } else {
        // If at min threshold or level-locked, restart at current level
        startNewGroup(currentLevel, transitionDelay);
      }
    };

    if (currentPreset.type === 'phrase') {
      if (newInput[newInput.length - 1] !== currentGroup[newInput.length - 1]) {
        handleWrong();
        return;
      }
    }

    if (newInput.length === currentGroup.length) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      setIsPlaying(false);

      let expectedGroup = currentGroup;
      if (currentPreset.id === 'cut_numbers') {
        expectedGroup = currentGroup.split('').map(c => SEQUENCE_PRESETS.CUT_NUMBERS.translation[c] || c).join('');
      }

      const isCorrect = newInput === expectedGroup;
      updatePerformanceData(isCorrect, currentLevel);

      if (isCorrect) {
        setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
        setHistory(prev => [...prev, { group: expectedGroup, userInput: newInput, correct: true }]);

        const newConsecutiveCorrect = consecutiveCorrect + 1;
        setConsecutiveCorrect(newConsecutiveCorrect);

        // Only advance level if not level-locked
        if (newConsecutiveCorrect >= advanceThreshold && currentLevel < morseRef.current.getMaxLevel() && !isLevelLocked) {
          updateLevelAndSpeed(currentLevel + 1, true);
          setConsecutiveCorrect(0);
          if (progressiveSpeedMode) {
            const newWpm = wpm + 1;
            showNotification(`Level ${currentLevel + 1}: Speed increased to ${newWpm} WPM`, 'green', transitionDelay);
          } else {
            showNotification(`Level up! Now at level ${currentLevel + 1}`, 'blue', transitionDelay);
          }
        } else {
          // If level is locked, give a notification when threshold is reached
          if (newConsecutiveCorrect >= advanceThreshold && isLevelLocked) {
            showNotification(`Threshold reached, but level is locked at ${currentLevel}`, 'yellow', transitionDelay);
            setConsecutiveCorrect(0);
          }
          startNewGroup(currentLevel, transitionDelay);
        }
      } else {
        handleWrong();
      }
    }
  }, [
    isPlaying, userInput, currentGroup, consecutiveCorrect, advanceThreshold,
    currentLevel, notification, updateLevelAndSpeed, currentPreset, progressiveSpeedMode,
    wpm, showNotification, startNewGroup, updatePerformanceData, transitionDelay,
    radioNoiseEnabled, minLevelThreshold, isLevelLocked, infiniteDelayEnabled
  ]);

  const handleCharacterRemoved = () => {
    const newInput = userInput.slice(0, -1);
    setUserInput(newInput);
  };

  const handleKeyPress = useCallback((e) => {
    // Allow input if we're in infinite delay mode, even with a notification
    const isInfiniteDelayWaiting = infiniteDelayEnabled && isPlaying && notification?.message?.includes('waiting for your answer');
    
    if ((!isPlaying || (notification && !isInfiniteDelayWaiting))) return;

    const key = e.key.toUpperCase();
    if (key === "BACKSPACE") {
      handleCharacterRemoved();
      return;
    }

    if (currentPreset.type === 'character') {
      const availableChars = morseRef.current.getAvailableChars(currentLevel);
      if (availableChars.includes(key)) {
        handleCharacterInput(key);
      }
    } else {
      handleCharacterInput(key);
    }
  }, [isPlaying, handleCharacterInput, notification, currentLevel, currentPreset, infiniteDelayEnabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      setIsPlaying(false);
      setCurrentGroup('');
      setUserInput('');
      setHistory([]);
      // Do NOT reset performance data when stopping
      // setPerformanceData([]);
      setScore({ correct: 0, wrong: 0 });
      setConsecutiveCorrect(0);
      setCurrentGroupSize(0);
      setShowAnswer(false);
    } else {
      startNewGroup(currentLevel);
    }
  };

  const handleFarnsworthChange = (delta) => {
    const newSpacing = Math.max(0, Math.min(15, farnsworthSpacing + delta));
    setFarnsworthSpacing(newSpacing);
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(currentLevel, transitionDelay);
    }
  };

  const handleGroupSizeChange = (delta) => {
    const newSize = Math.max(1, Math.min(10, groupSize + delta));
    setGroupSize(newSize);
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(currentLevel, transitionDelay);
    }
  };

  const handleMinGroupSizeChange = (delta) => {
    const newSize = Math.max(1, Math.min(10, minGroupSize + delta));
    setMinGroupSize(newSize);
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(currentLevel, transitionDelay);
    }
  };

  const handleMaxRepeatsChange = (newValue) => {
    setMaxRepeats(newValue);
    // No need to restart playback - will apply on next sequence
  };

  const handleFrequencyChange = (delta) => {
    const newFreq = Math.max(400, Math.min(1000, frequency + delta));
    setFrequency(newFreq);
    morseAudio.setFrequency(newFreq);
    if (radioNoiseEnabled) {
      filterNoise.syncFrequency(newFreq);
    }
  };

  const handleWpmChange = (delta) => {
    const newWpm = Math.max(5, Math.min(50, wpm + delta));
    setWpm(newWpm);

    // If Morse is playing, update filter noise to match potential volume changes
    if (isPlaying && radioNoiseEnabled) {
      // Update reference to current Morse audio volume
      filterNoise.setMorseAudioVolume(morseAudio.getCurrentVolume());
    }

    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(currentLevel, transitionDelay);
    }
  };

  // Filter noise controls
  const handleRadioNoiseToggle = () => {
    const newState = !radioNoiseEnabled;
    setRadioNoiseEnabled(newState);
    if (newState && isPlaying) {
      filterNoise.syncFrequency(frequency);
      filterNoise.start();
    } else {
      filterNoise.stop();
    }
  };

  const handleRadioNoiseVolumeChange = (delta) => {
    const newVolume = Math.max(0, Math.min(5.0, radioNoiseVolume + delta));
    setRadioNoiseVolume(newVolume);
    filterNoise.setVolume(newVolume);
  };

  const handleRadioNoiseResonanceChange = (delta) => {
    const newValue = Math.max(5, Math.min(50, radioNoiseResonance + delta));
    setRadioNoiseResonance(newValue);
    filterNoise.updateParameter('filterResonance', newValue);
  };

  const handleRadioNoiseWarmthChange = (delta) => {
    const newValue = Math.max(0, Math.min(15, radioNoiseWarmth + delta));
    setRadioNoiseWarmth(newValue);
    filterNoise.updateParameter('warmth', newValue);
  };

  const handleRadioNoiseDriftChange = (delta) => {
    const newValue = Math.max(0, Math.min(2, radioNoiseDrift + delta));
    setRadioNoiseDrift(newValue);
    filterNoise.updateParameter('driftSpeed', newValue);
  };

  const handleRadioNoiseAtmosphericChange = (delta) => {
    const newValue = Math.max(0, Math.min(8.0, radioNoiseAtmospheric + delta));
    setRadioNoiseAtmospheric(newValue);
    filterNoise.updateParameter('atmosphericIntensity', newValue);
  };

  const handleRadioNoiseCrackleChange = (delta) => {
    const newValue = Math.max(0, Math.min(0.3, radioNoiseCrackle + delta));
    setRadioNoiseCrackle(newValue);
    filterNoise.updateParameter('crackleIntensity', newValue);
  };

  // QSB control
  const handleQsbChange = (delta) => {
    const newAmount = Math.max(0, Math.min(100, qsbAmount + delta));
    setQsbAmount(newAmount);
    morseAudio.setQsbAmount(newAmount);
  };

  const handleHeadCopyMode = () => {
    setHeadCopyMode(!headCopyMode);
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(currentLevel, transitionDelay);
    }
  };

  const handleHideChars = () => {
    setHideChars(!hideChars);
  };

  const handleShowAnswer = () => {
    if (headCopyMode && isPlaying) {
      setShowAnswer(true);
    }
  };

  const handlePresetChange = (presetId) => {
    morseRef.current.setPreset(presetId);
    setCurrentPreset(morseRef.current.getCurrentPreset());
    setCurrentLevel(1);
    setConsecutiveCorrect(0);
    // Reset minimum level threshold when changing presets
    setMinLevelThreshold(1);
    setIsLevelLocked(false);
    showNotification(`Switched to ${morseRef.current.getCurrentPreset().name}`, 'blue', transitionDelay);
    if (isPlaying) {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
      startNewGroup(1, transitionDelay);
    }
  };

  const handleAdvanceThresholdChange = (delta) => {
    const newThreshold = Math.max(1, Math.min(10, advanceThreshold + delta));
    setAdvanceThreshold(newThreshold);
  };

  // Runner-specific handlers
  const handleQsoRateChange = (delta) => {
    const newRate = Math.max(1, Math.min(10, qsoRate + delta));
    setQsoRate(newRate);
  };

  const handleSendDelayChange = (delta) => {
    const newDelay = Math.max(0.1, Math.min(2, sendDelay + delta));
    setSendDelay(newDelay);
  };

  const handleShowExchangePreviewToggle = () => {
    setShowExchangePreview(!showExchangePreview);
  };

  const handleContestTypeChange = (contestTypeId) => {
    const newContestType = Object.values(CONTEST_TYPES).find(ct => ct.id === contestTypeId);
    if (newContestType) {
      setContestType(newContestType);
    }
  };

  const handleTabChange = (tab) => {
    if (activeModeTab === 'trainer' && tab !== 'trainer' && isPlaying) {
      handleTogglePlay();
    }
    if (activeModeTab === 'runner' && tab !== 'runner') {
      morseAudio.stop();
      if (radioNoiseEnabled) filterNoise.stop();
    }
    setActiveModeTab(tab);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying) {
        morseAudio.stop();
        if (radioNoiseEnabled) filterNoise.stop();
        setIsPaused(true);
        showNotification('Audio paused - tab inactive', 'yellow', transitionDelay);
      } else if (!document.hidden && isPaused && isPlaying) {
        setIsPaused(false);
        startNewGroup(currentLevel, transitionDelay);
        showNotification('Audio resumed', 'blue', transitionDelay);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, isPaused, currentLevel, showNotification, startNewGroup, transitionDelay, radioNoiseEnabled]);

  // Add a function to clear performance data (for testing/debugging)
  const clearPerformanceData = () => {
    PerformanceDataManager.clear();
    setPerformanceData([]);
    showNotification('Performance data cleared', 'red', 2000);
  };

  // Mode tab selection UI
  const ModeSelector = () => (
    <div className="max-w-7xl mx-auto px-4 pt-16 pb-4">
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
            activeModeTab === 'trainer'
              ? 'bg-gray-800 text-blue-400 border-t border-l border-r border-gray-700'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => handleTabChange('trainer')}
        >
          Morse Trainer
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
            activeModeTab === 'runner'
              ? 'bg-gray-800 text-blue-400 border-t border-l border-r border-gray-700'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => handleTabChange('runner')}
        >
          Contest Runner
        </button>
      </div>
    </div>
  );

  return (
    <>
      {activeModeTab === 'runner' && <AlphaBanner />}
      <ModeSelector />

      {/* Shared Settings Button - appears in both modes */}
      <SettingsButton
        onClick={() => setIsSettingsPanelVisible(!isSettingsPanelVisible)}
        isActive={isSettingsPanelVisible}
      />

      {/* Shared Settings Panel - content adapts based on active mode */}
      <SharedSettingsPanel
        isVisible={isSettingsPanelVisible}
        onVisibilityChange={setIsSettingsPanelVisible}
        activeModeTab={activeModeTab}

        // Audio settings (shared)
        frequency={frequency}
        onFrequencyChange={handleFrequencyChange}
        wpm={wpm}
        onWpmChange={handleWpmChange}
        farnsworthSpacing={farnsworthSpacing}
        onFarnsworthChange={handleFarnsworthChange}
        qsbAmount={qsbAmount}
        onQsbChange={handleQsbChange}
        levelSpacing={levelSpacing}
        onLevelSpacingChange={handleLevelSpacingChange}
        transitionDelay={transitionDelay}
        onTransitionDelayChange={handleTransitionDelayChange}
        progressiveSpeedMode={progressiveSpeedMode}
        onProgressiveSpeedToggle={handleProgressiveSpeedToggle}

        // Filter noise settings (shared)
        radioNoiseEnabled={radioNoiseEnabled}
        onRadioNoiseToggle={handleRadioNoiseToggle}
        radioNoiseVolume={radioNoiseVolume}
        onRadioNoiseVolumeChange={handleRadioNoiseVolumeChange}
        radioNoiseResonance={radioNoiseResonance}
        onRadioNoiseResonanceChange={handleRadioNoiseResonanceChange}
        radioNoiseWarmth={radioNoiseWarmth}
        onRadioNoiseWarmthChange={handleRadioNoiseWarmthChange}
        radioNoiseDrift={radioNoiseDrift}
        onRadioNoiseDriftChange={handleRadioNoiseDriftChange}
        radioNoiseAtmospheric={radioNoiseAtmospheric}
        onRadioNoiseAtmosphericChange={handleRadioNoiseAtmosphericChange}
        radioNoiseCrackle={radioNoiseCrackle}
        onRadioNoiseCrackleChange={handleRadioNoiseCrackleChange}
        filterBandwidth={filterBandwidth}
        onFilterBandwidthChange={handleFilterBandwidthChange}

        // Trainer-specific settings
        currentLevel={currentLevel}
        onLevelChange={handleLevelChange}
        groupSize={groupSize}
        onGroupSizeChange={handleGroupSizeChange}
        minGroupSize={minGroupSize}
        onMinGroupSizeChange={handleMinGroupSizeChange}
        maxRepeats={maxRepeats}
        onMaxRepeatsChange={handleMaxRepeatsChange}
        advanceThreshold={advanceThreshold}
        onAdvanceThresholdChange={handleAdvanceThresholdChange}
        consecutiveCorrect={consecutiveCorrect}
        headCopyMode={headCopyMode}
        onHeadCopyMode={handleHeadCopyMode}
        infiniteDelayEnabled={infiniteDelayEnabled}
        onInfiniteDelayToggle={handleInfiniteDelayToggle}
        hideChars={hideChars}
        onHideChars={handleHideChars}
        availableChars={morseRef.current.getAvailableChars(currentLevel)}
        presets={morseRef.current.getPresets()}
        currentPreset={currentPreset}
        onPresetChange={handlePresetChange}
        onCustomizeClick={() => setIsModalOpen(true)}

        // Level lock settings (new)
        minLevelThreshold={minLevelThreshold}
        onMinLevelThresholdChange={handleMinLevelThresholdChange}
        isLevelLocked={isLevelLocked}
        onLevelLockToggle={handleLevelLockToggle}

        // Runner-specific settings
        qsoRate={qsoRate}
        onQsoRateChange={handleQsoRateChange}
        sendDelay={sendDelay}
        onSendDelayChange={handleSendDelayChange}
        showExchangePreview={showExchangePreview}
        onShowExchangePreviewToggle={handleShowExchangePreviewToggle}
        contestType={contestType}
        onContestTypeChange={handleContestTypeChange}
        contestTypes={CONTEST_TYPES}
      />

      {activeModeTab === 'trainer' ? (
        <MorseUI
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          currentLevel={currentLevel}
          groupSize={groupSize}
          minGroupSize={minGroupSize}
          maxRepeats={maxRepeats}
          frequency={frequency}
          wpm={wpm}
          availableChars={morseRef.current.getAvailableChars(currentLevel)}
          consecutiveCorrect={consecutiveCorrect}
          userInput={userInput}
          currentGroupSize={currentGroupSize}
          score={score}
          history={history}
          maxLevel={morseRef.current.getMaxLevel()}
          notification={notification}
          onCharacterInput={handleCharacterInput}
          performanceData={performanceData}
          headCopyMode={headCopyMode}
          hideChars={hideChars}
          showAnswer={showAnswer}
          onShowAnswer={handleShowAnswer}
          currentGroup={headCopyMode && !showAnswer ? '' : currentGroup}
          qsbAmount={qsbAmount}
          presets={morseRef.current.getPresets()}
          currentPreset={currentPreset}
          advanceThreshold={advanceThreshold}
          farnsworthSpacing={farnsworthSpacing}
          progressiveSpeedMode={progressiveSpeedMode}
          customSequence={customSequence}
          levelSpacing={levelSpacing}
          transitionDelay={transitionDelay}
          // Filter noise parameters
          radioNoiseEnabled={radioNoiseEnabled}
          filterBandwidth={filterBandwidth}
          infiniteDelayEnabled={infiniteDelayEnabled}
          // Debug function - remove for production if desired
          onClearPerformanceData={clearPerformanceData}
          // Level lock indicators (can be displayed in the UI)
          minLevelThreshold={minLevelThreshold}
          isLevelLocked={isLevelLocked}
          // Remove handler props, they'll be called from the settings panel
          isSettingsPanelVisible={isSettingsPanelVisible}
        />
      ) : (
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <MorseRunnerController
            wpm={wpm}
            qsbAmount={qsbAmount}
            farnsworthSpacing={farnsworthSpacing}
            frequency={frequency}
            filterNoiseEnabled={radioNoiseEnabled}
            onFilterNoiseToggle={handleRadioNoiseToggle}
            radioNoiseVolume={radioNoiseVolume}
            radioNoiseResonance={radioNoiseResonance}
            radioNoiseWarmth={radioNoiseWarmth}
            radioNoiseDrift={radioNoiseDrift}
            radioNoiseAtmospheric={radioNoiseAtmospheric}
            radioNoiseCrackle={radioNoiseCrackle}
            filterBandwidth={filterBandwidth}
            qsoRate={qsoRate}
            sendDelay={sendDelay}
            showExchangePreview={showExchangePreview}
            contestType={contestType}
            onWpmChange={handleWpmChange}
          />
        </div>
      )}

      <CustomAlphabetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedChars={customSequence.split('')}
        onSave={saveCustomSequence}
      />
    </>
  );
};

export default MorseTrainer;