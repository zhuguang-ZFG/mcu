#!/usr/bin/env node
/**
 * 将 C3 volatile 视频 HTML 转换为高清 MP4
 * 
 * 用法: node scripts/render-video.mjs
 * 输出: docs/video/c3-volatile-final.mp4
 */

import puppeteer from 'puppeteer';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const FPS = 30;
const OUTPUT_DIR = join(__dirname, '..', 'docs', 'video', 'frames');
const OUTPUT_FILE = join(__dirname, '..', 'docs', 'video', 'c3-volatile-final.mp4');

async function renderVideo() {
  console.log('🎬 开始渲染视频...');
  console.log(`分辨率: ${VIDEO_WIDTH}x${VIDEO_HEIGHT} @ ${FPS}fps`);
  
  // 创建输出目录
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${VIDEO_WIDTH},${VIDEO_HEIGHT}`
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    deviceScaleFactor: 2 // 2x 渲染，更清晰
  });
  
  // 加载 HTML
  const htmlPath = join(__dirname, '..', 'docs', 'video', 'c3-volatile-video.html');
  const htmlUrl = `file://${htmlPath.replace(/\\/g, '/')}`;
  
  console.log('📄 加载 HTML...');
  await page.goto(htmlUrl, { waitUntil: 'networkidle0' });
  
  // 获取所有场景
  const scenes = await page.$$('.scene');
  const sceneCount = scenes.length;
  
  console.log(`📊 共 ${sceneCount} 个场景`);
  
  let frameIndex = 0;
  
  // 逐个场景渲染
  for (let i = 0; i < sceneCount; i++) {
    console.log(`\n🎞️  渲染场景 ${i + 1}/${sceneCount}...`);
    
    // 获取场景持续时间（毫秒）
    const duration = await page.$eval(`.scene:nth-child(${i + 1})`, el => {
      return parseInt(el.dataset.duration) || 10000;
    });
    
    const frameCount = Math.ceil((duration / 1000) * FPS);
    console.log(`   时长: ${duration}ms → ${frameCount} 帧`);
    
    // 跳转到该场景
    await page.evaluate((sceneIndex) => {
      showScene(sceneIndex);
    }, i);
    
    // 等待动画稳定
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 捕获每一帧
    for (let f = 0; f < frameCount; f++) {
      const framePath = join(OUTPUT_DIR, `frame_${String(frameIndex).padStart(5, '0')}.png`);
      
      await page.screenshot({
        path: framePath,
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT
        }
      });
      
      frameIndex++;
      
      // 进度显示
      if (f % 10 === 0) {
        process.stdout.write(`\r   帧: ${f}/${frameCount}`);
      }
      
      // 短暂延迟模拟时间流逝（如果需要动画效果）
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`\n   ✓ 场景 ${i + 1} 完成`);
  }
  
  await browser.close();
  
  console.log(`\n🎥 共捕获 ${frameIndex} 帧`);
  console.log('🔧 开始合成 MP4...');
  
  // 使用 ffmpeg 合成视频
  await new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-y',
      '-framerate', String(FPS),
      '-i', join(OUTPUT_DIR, 'frame_%05d.png'),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '18', // 高质量
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      OUTPUT_FILE
    ];
    
    console.log(`\n执行: ${ffmpeg} ${ffmpegArgs.join(' ')}\n`);
    
    const proc = spawn(ffmpeg, ffmpegArgs);
    
    proc.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    proc.stderr.on('data', (data) => {
      // ffmpeg 输出到 stderr
      const str = data.toString();
      if (str.includes('frame=') || str.includes('time=')) {
        process.stdout.write(`\r${str.trim()}`);
      }
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('\n\n✅ 视频合成完成！');
        resolve();
      } else {
        reject(new Error(`ffmpeg 退出码: ${code}`));
      }
    });
  });
  
  // 清理帧文件
  console.log('🧹 清理临时帧文件...');
  fs.rmSync(OUTPUT_DIR, { recursive: true });
  
  // 显示文件信息
  const stats = fs.statSync(OUTPUT_FILE);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log(`\n📦 输出文件: ${OUTPUT_FILE}`);
  console.log(`   大小: ${sizeMB} MB`);
  console.log(`   分辨率: ${VIDEO_WIDTH}x${VIDEO_HEIGHT}`);
  console.log(`   帧率: ${FPS}fps`);
  console.log('\n🎉 完成！可以用 OBS 或直接上传到 B 站。');
}

renderVideo().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
