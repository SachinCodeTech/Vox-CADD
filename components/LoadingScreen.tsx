
import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VoxIcon from './VoxIcon';

const LoadingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let currentProgress = 0;
    const intervalTime = 16; // 60fps updates for buttery smooth responsiveness
    
    const timer = setInterval(() => {
      // Modern progress curve: fast then slow, but completed very quickly
      const increment = currentProgress > 85 ? Math.random() * 8 + 6 : Math.random() * 20 + 15;
      currentProgress += increment;

      if (currentProgress >= 100) {
        currentProgress = 100;
        setProgress(100);
        clearInterval(timer);
        setTimeout(onComplete, 100); // Trigger completion fast (100ms instead of 1000ms)
      } else {
        setProgress(currentProgress);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
      className="fixed inset-0 z-[10000] bg-[#050507] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Dynamic Geometric Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         <motion.div 
           animate={{ 
             scale: [1, 1.2, 1],
             opacity: [0.05, 0.1, 0.05]
           }}
           transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
           className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent" 
         />
         <div className="w-full h-full opacity-5" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
         
         {/* Moving light streaks */}
         <motion.div 
           animate={{ x: ['-100%', '200%'] }}
           transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
           className="absolute top-1/4 left-0 w-32 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent rotate-45"
         />
         <motion.div 
           animate={{ x: ['200%', '-100%'] }}
           transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1 }}
           className="absolute bottom-1/3 left-0 w-48 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent -rotate-12"
         />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center z-10"
      >
        {/* Advanced Logo Animation */}
        <div className="relative mb-16">
          <motion.div
            animate={{ 
              boxShadow: [
                "0 0 20px rgba(6,182,212,0.1)",
                "0 0 40px rgba(6,182,212,0.3)",
                "0 0 20px rgba(6,182,212,0.1)"
              ]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-28 h-28 rounded-[2rem] bg-black border border-cyan-500/30 flex items-center justify-center relative overflow-hidden"
          >
            {/* Spinning decorative rings */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-[1px] border-dashed border-cyan-500/10 rounded-[2rem] scale-[1.4]"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-[0.5px] border-cyan-500/5 rounded-[2rem] scale-[1.1]"
            />
            
            {/* Glitchy scanner effect */}
            <motion.div 
              animate={{ top: ['-10%', '110%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-0 right-0 h-[2px] bg-cyan-400/20 z-20 blur-[1px]"
            />

            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <VoxIcon size={72} className="relative z-10 text-cyan-400" />
            </motion.div>
          </motion.div>
          
          <motion.div 
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/30 border border-cyan-500/20 backdrop-blur-sm">
              <Zap size={10} className="text-cyan-400 fill-cyan-400" />
              <span className="text-[8px] font-black text-cyan-400 uppercase tracking-[0.4em]">SYSTEM_v1.0.3</span>
            </div>
          </motion.div>
        </div>

        {/* Text and Progress UI */}
        <div className="flex flex-col items-center gap-6 w-72 lg:w-96">
          <div className="flex flex-col items-center gap-1">
            <motion.h1 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl uppercase tracking-[0.3em] italic flex items-center"
            >
              <span className="text-white font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">VOX</span>
              <span className="text-cyan-500 font-bold ml-1.5 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">CADD</span>
            </motion.h1>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent w-full"
            />
          </div>

          <div className="w-full space-y-2">
            <div className="flex justify-between items-end px-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: progress > (i * 25) ? 1 : 0.2 }}
                    className="w-1.5 h-1.5 bg-cyan-500 rounded-full"
                  />
                ))}
              </div>
              <span className="text-cyan-400 font-mono text-xs font-black tracking-tighter">
                {progress < 100 ? `SYNCING_${Math.floor(progress)}%` : "READY_ACCESS"}
              </span>
            </div>

            {/* High-fidelity Progress Bar */}
            <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,1)]"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.2 }}
              />
              {/* Internal glow effect */}
              <motion.div 
                className="absolute inset-y-0 left-0 bg-white/40 blur-[2px]"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.2 }}
              />
            </div>
          </div>

          {/* Status Message Line */}
          <div className="h-4">
            <AnimatePresence mode="wait">
              <motion.span 
                key={Math.floor(progress / 15)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.5em] text-center block"
              >
                {progress < 15 && "MOUNTING_FS"}
                {progress >= 15 && progress < 30 && "KERNEL_BOOT"}
                {progress >= 30 && progress < 45 && "SNAP_INIT"}
                {progress >= 45 && progress < 60 && "GEO_PIPELINE"}
                {progress >= 60 && progress < 75 && "CORE_CALIBRATION"}
                {progress >= 75 && progress < 90 && "REACHING_UPLINK"}
                {progress >= 90 && progress < 100 && "FINALIZING"}
                {progress >= 100 && "SYSTEM_ONLINE"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Corporate Metadata Footer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-10 flex flex-col items-center gap-3 opacity-30 group"
      >
         <div className="h-[1px] w-12 bg-neutral-800 transition-all group-hover:w-24 group-hover:bg-cyan-900" />
         <div className="flex items-center gap-6 text-neutral-600 text-[8px] font-black uppercase tracking-[0.5em]">
            <span>ENGINEERED</span>
            <span>PRECISION</span>
            <span>AUTONOMY</span>
         </div>
      </motion.div>
    </motion.div>
  );
};

export default LoadingScreen;
