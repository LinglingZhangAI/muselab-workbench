export type WeatherKind='sun'|'cloud'|'rain'|'snow'|'storm'|'fog'|'moon';
export type HangzhouWeather={date:string;observedAt:string;fetchedAt:string;temperature:number;feelsLike:number;low:number;high:number;rainChance:number;humidity:number;wind:number;code:number;isDay:boolean;condition:string;kind:WeatherKind;stale?:boolean;warning?:string};
export function weatherCondition(code:number):{condition:string;kind:WeatherKind}{
 if(code===0)return {condition:'晴',kind:'sun'};
 if(code===1)return {condition:'晴间多云',kind:'cloud'};
 if(code===2)return {condition:'多云',kind:'cloud'};
 if(code===3)return {condition:'阴',kind:'cloud'};
 if([45,48].includes(code))return {condition:'有雾',kind:'fog'};
 if([51,53,55,56,57].includes(code))return {condition:'毛毛雨',kind:'rain'};
 if([61,66,80].includes(code))return {condition:'小雨',kind:'rain'};
 if([63,81].includes(code))return {condition:'中雨',kind:'rain'};
 if([65,67,82].includes(code))return {condition:'大雨',kind:'rain'};
 if([71,73,75,77,85,86].includes(code))return {condition:'降雪',kind:'snow'};
 if([95,96,99].includes(code))return {condition:'雷阵雨',kind:'storm'};
 throw new Error('未知天气代码');
}
