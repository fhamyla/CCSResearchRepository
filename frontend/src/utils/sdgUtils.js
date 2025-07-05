// SDG mapping utility
export const SDG_MAPPING = {
  '1': 'SDG 1: No Poverty',
  '2': 'SDG 2: Zero Hunger',
  '3': 'SDG 3: Good Health and Well-being',
  '4': 'SDG 4: Quality Education',
  '5': 'SDG 5: Gender Equality',
  '6': 'SDG 6: Clean Water and Sanitation',
  '7': 'SDG 7: Affordable and Clean Energy',
  '8': 'SDG 8: Decent Work and Economic Growth',
  '9': 'SDG 9: Industry, Innovation and Infrastructure',
  '10': 'SDG 10: Reduced Inequality',
  '11': 'SDG 11: Sustainable Cities and Communities',
  '12': 'SDG 12: Responsible Consumption and Production',
  '13': 'SDG 13: Climate Action',
  '14': 'SDG 14: Life Below Water',
  '15': 'SDG 15: Life on Land',
  '16': 'SDG 16: Peace and Justice Strong Institutions',
  '17': 'SDG 17: Partnerships to achieve the Goal'
};

// SDG descriptions for tooltips
export const SDG_DESCRIPTIONS = {
  '1': 'End poverty in all its forms everywhere. This goal aims to eradicate extreme poverty and ensure economic security for all people.',
  '2': 'End hunger, achieve food security and improved nutrition, and promote sustainable agriculture worldwide.',
  '3': 'Ensure healthy lives and promote well-being for all at all ages, including universal health coverage and access to quality healthcare.',
  '4': 'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.',
  '5': 'Achieve gender equality and empower all women and girls by eliminating discrimination and violence.',
  '6': 'Ensure availability and sustainable management of water and sanitation for all people.',
  '7': 'Ensure access to affordable, reliable, sustainable, and modern energy for all while promoting renewable energy sources.',
  '8': 'Promote sustained, inclusive, and sustainable economic growth, full employment, and decent work for all.',
  '9': 'Build resilient infrastructure, promote inclusive and sustainable industrialization, and foster innovation.',
  '10': 'Reduce inequality within and among countries by promoting social, economic, and political inclusion.',
  '11': 'Make cities and human settlements inclusive, safe, resilient, and sustainable through better urban planning.',
  '12': 'Ensure sustainable consumption and production patterns to reduce environmental impact and promote resource efficiency.',
  '13': 'Take urgent action to combat climate change and its impacts through mitigation and adaptation measures.',
  '14': 'Conserve and sustainably use the oceans, seas, and marine resources for sustainable development.',
  '15': 'Protect, restore, and promote sustainable use of terrestrial ecosystems and halt biodiversity loss.',
  '16': 'Promote peaceful and inclusive societies, provide access to justice, and build effective institutions.',
  '17': 'Strengthen the means of implementation and revitalize global partnerships for sustainable development.'
};

// Get all available SDGs in full format
export const getAllSDGs = () => {
  return Object.values(SDG_MAPPING);
};

// Get SDG description for tooltip
export const getSDGDescription = (sdgId) => {
  return SDG_DESCRIPTIONS[String(sdgId)] || 'Description not available';
};

// Convert SDG number to full text
export const getSDGFullText = (sdgValue) => {
  if (!sdgValue) return 'Unknown SDG';
  
  // Handle different formats
  let sdgNumber = sdgValue;
  
  // If it's already in full format, return as is
  if (typeof sdgValue === 'string' && sdgValue.toLowerCase().includes('sdg') && sdgValue.includes(':')) {
    return sdgValue;
  }
  
  // Extract number from various formats
  if (typeof sdgValue === 'string') {
    // If it's just a number, use it directly
    if (/^\d+$/.test(sdgValue.trim())) {
      sdgNumber = sdgValue.trim();
    } else {
      const match = sdgValue.match(/(\d+)/);
      if (match) {
        sdgNumber = match[1];
      }
    }
  } else if (typeof sdgValue === 'number') {
    sdgNumber = String(sdgValue);
  } else if (typeof sdgValue === 'object' && sdgValue !== null) {
    // Handle object format
    if (sdgValue.name && typeof sdgValue.name === 'string' && 
        sdgValue.name.toLowerCase().includes('sdg') && sdgValue.name.includes(':')) {
      return sdgValue.name;
    }
    
    const id = sdgValue.id || sdgValue.value || sdgValue.number;
    if (id) {
      if (typeof id === 'number') {
        sdgNumber = String(id);
      } else {
        const match = String(id).match(/(\d+)/);
        if (match) {
          sdgNumber = match[1];
        }
      }
    }
  }
  
  // Return full text or fallback
  return SDG_MAPPING[String(sdgNumber)] || `SDG ${sdgNumber}` || 'Unknown SDG';
};

// Extract SDG number from full text or various formats
export const extractSDGNumber = (sdgValue) => {
  if (!sdgValue) return null;
  
  let str = '';
  
  if (typeof sdgValue === 'object') {
    str = String(sdgValue.name || sdgValue.id || sdgValue.value || '');
  } else {
    str = String(sdgValue);
  }
  
  // If it's already just a number, return it
  if (/^\d+$/.test(str.trim())) {
    return str.trim();
  }
  
  // Extract number from text
  const match = str.match(/(\d+)/);
  return match ? match[1] : null;
};

// Check if two SDG values match (handles different formats)
export const sdgMatches = (sdg1, sdg2) => {
  if (!sdg1 || !sdg2) return false;
  
  try {
    const num1 = extractSDGNumber(sdg1);
    const num2 = extractSDGNumber(sdg2);
    
    return num1 && num2 && num1 === num2;
  } catch (error) {
    console.warn('Error in sdgMatches:', error, 'SDG1:', sdg1, 'SDG2:', sdg2);
    return false;
  }
};

// Normalize SDG for comparison
export const normalizeSDG = (sdgValue) => {
  const number = extractSDGNumber(sdgValue);
  return number ? SDG_MAPPING[number] : null;
};
