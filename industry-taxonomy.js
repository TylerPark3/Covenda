(() => {
  const workTypes = [
    { value: 'Research', label: 'Research & strategy', description: 'Markets, customers, products, and decisions' },
    { value: 'Data & spreadsheets', label: 'Data & analysis', description: 'Models, cleanup, reporting, and insights' },
    { value: 'Operations', label: 'Operations', description: 'Processes, programs, vendors, and execution' },
    { value: 'QA & testing', label: 'Testing & evaluation', description: 'Test cases, bugs, quality, and model evaluation' },
    { value: 'Writing & documentation', label: 'Writing & documentation', description: 'Briefs, SOPs, explainers, and knowledge' },
  ];

  const groups = [
    {
      slug: 'technology',
      label: 'Technology',
      description: 'Software, AI, data, and new computing',
      sectors: [
        'Artificial intelligence & machine learning',
        'Developer tools & infrastructure',
        'Data & analytics',
        'Cybersecurity & privacy',
        'Enterprise software & SaaS',
        'Consumer software & apps',
        'Hardware, robotics & IoT',
        'Gaming, AR & VR',
        'Web3 & blockchain',
      ],
    },
    {
      slug: 'finance',
      label: 'Finance',
      description: 'Money, markets, payments, and ownership',
      sectors: [
        'Banking & payments',
        'Investing & wealth management',
        'Insurance & insurtech',
        'Lending, credit & underwriting',
        'Accounting & finance tools',
        'Private markets & venture capital',
        'Real estate & proptech',
        'Crypto & digital assets',
      ],
    },
    {
      slug: 'health',
      label: 'Health',
      description: 'Care, science, wellness, and life sciences',
      sectors: [
        'Digital health',
        'Healthcare services & operations',
        'Biotech & life sciences',
        'Pharmaceuticals & drug discovery',
        'Medical devices & diagnostics',
        'Mental health & behavioral health',
        'Fitness, wellness & longevity',
        'Health insurance & benefits',
      ],
    },
    {
      slug: 'consumer',
      label: 'Consumer',
      description: 'Products and experiences people use every day',
      sectors: [
        'E-commerce & marketplaces',
        'Food & beverage',
        'Media, entertainment & creators',
        'Travel & hospitality',
        'Fashion, beauty & personal care',
        'Social, community & dating',
        'Education & learning',
        'Sports & recreation',
      ],
    },
    {
      slug: 'business',
      label: 'Business',
      description: 'Tools and services that help organizations grow',
      sectors: [
        'Sales, marketing & advertising',
        'HR, recruiting & future of work',
        'Legal, compliance & regtech',
        'Professional & advisory services',
        'Productivity & collaboration',
        'Customer support & success',
        'Operations & workflow automation',
        'Logistics & supply chain software',
      ],
    },
    {
      slug: 'climate-industry',
      label: 'Climate & industry',
      description: 'Energy, infrastructure, and the physical world',
      sectors: [
        'Climate tech & sustainability',
        'Energy generation & storage',
        'Manufacturing & industrial technology',
        'Mobility & transportation',
        'Aerospace, space & defense',
        'Agriculture & food systems',
        'Construction & infrastructure',
        'Logistics, shipping & supply chain',
        'Materials, chemicals & mining',
      ],
    },
  ];

  const legacyGroups = Object.freeze({
    'Accounting & finance': 'Finance',
    'Software & AI': 'Technology',
    'Healthcare operations': 'Health',
    'Consumer & retail': 'Consumer',
    'Professional services': 'Business',
    'Not sure yet — show me everything': 'Open to any industry',
  });

  const frozenGroups = groups.map(group => Object.freeze({
    ...group,
    sectors: Object.freeze([...group.sectors]),
  }));
  const frozenWorkTypes = workTypes.map(workType => Object.freeze({ ...workType }));

  Object.defineProperty(globalThis, 'CovendaIndustryTaxonomy', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: Object.freeze({
      version: '2026-07-27',
      groups: Object.freeze(frozenGroups),
      workTypes: Object.freeze(frozenWorkTypes),
      legacyGroups,
      openChoice: 'Open to any industry',
    }),
  });
})();
