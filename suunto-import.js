(function(){
'use strict';
function finite(x){return typeof x==='number'&&Number.isFinite(x)}
function parse(raw){
 const log=raw?.DeviceLog,header=log?.Header,samples=log?.Samples;
 if(!header||!Array.isArray(samples)||samples.length<5||!header.DateTime||!finite(header.DiveTime)||!finite(header.Depth?.Max))throw Error('Keine gültige Suunto-Ocean-Tauchgangdatei.');
 const start=Date.parse(header.DateTime);if(!Number.isFinite(start))throw Error('Startzeit fehlt oder ist ungültig.');
 const date=header.DateTime.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ungültiges Datum.');
 const durationSeconds=header.DiveTime;if(durationSeconds<=0||durationSeconds>12*3600)throw Error('Unplausible Tauchdauer.');
 const depth=Number(header.Depth.Max.toFixed(1)),avgDepth=finite(header.DepthAverage)?Number(header.DepthAverage.toFixed(2)):null;
 const timed=(x)=>{const t=Date.parse(x.TimeISO8601);return Number.isFinite(t)?(t-start)/60000:NaN};
 const validTime=t=>Number.isFinite(t)&&t>=0&&t<=durationSeconds/60+3;
 const rawDepth=samples.filter(x=>finite(x.Depth)&&validTime(timed(x))).map(x=>[timed(x),Math.max(0,x.Depth)]).sort((a,b)=>a[0]-b[0]);
 // Samples contain a real depth value every ~10s; keep at most 450 points for local storage.
 const stride=Math.max(1,Math.ceil(rawDepth.length/450));const profile=rawDepth.filter((_,i)=>i%stride===0||i===rawDepth.length-1).map(([t,d])=>[Number(t.toFixed(2)),Number(d.toFixed(2))]);
 if(profile.length<5)throw Error('Keine ausreichenden Tiefenmessungen in der Datei.');
 const pressure=samples.filter(x=>validTime(timed(x))&&finite(x.Cylinders?.[0]?.Pressure)&&x.Cylinders[0].Pressure>0).map(x=>[timed(x),x.Cylinders[0].Pressure/100000]).filter(x=>x[1]<450).sort((a,b)=>a[0]-b[0]);
 const pressures=pressure.map(([t,v])=>[Number(t.toFixed(2)),Number(v.toFixed(1))]);
 const tempSamples=samples.filter(x=>finite(x.Temperature)&&x.Temperature>240&&x.Temperature<340).map(x=>x.Temperature-273.15);
 const temperatureC=tempSamples.length?Number((tempSamples.reduce((a,b)=>a+b,0)/tempSamples.length).toFixed(1)):null;
 const heartRate=samples.filter(x=>finite(x.HR)&&validTime(timed(x))&&x.HR>.3&&x.HR<4).filter((_,i)=>i%10===0).map(x=>[Number(timed(x).toFixed(2)),Math.round(x.HR*60)]);
 const gps=samples.filter(x=>finite(x.Latitude)&&finite(x.Longitude)&&x.Latitude!==0&&x.Longitude!==0).map(x=>({lat:x.Latitude*180/Math.PI,lon:x.Longitude*180/Math.PI,time:timed(x)})).filter(x=>Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180);
 const gpsEnd=gps.filter(x=>x.time>durationSeconds/60-5);const point=gpsEnd.length?gpsEnd[gpsEnd.length-1]:null;
 const sourceKey=header.DateTime+'|'+header.DiveTime+'|'+header.Depth.Max;
 return {sourceKey,date,startedAt:header.DateTime,durationSeconds,durationLabel:Math.floor(durationSeconds/60)+':'+String(Math.round(durationSeconds%60)).padStart(2,'0'),depth,avgDepth,temperatureC,profile,pressure:pressures,heartRate,startBar:pressures.length?Math.round(pressures[0][1]):null,endBar:pressures.length?Math.round(pressures[pressures.length-1][1]):null,latitude:point?Number(point.lat.toFixed(6)):null,longitude:point?Number(point.lon.toFixed(6)):null};
}
window.OceanSuunto={parse};
})();