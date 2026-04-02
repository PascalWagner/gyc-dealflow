import test from 'node:test';
import assert from 'node:assert/strict';

import {
	buildReviewFieldEvidenceHref,
	buildReviewFieldEvidenceMap,
	formatReviewFieldEvidenceAnchor,
	getMissingRequiredEvidenceFieldKeys
} from '../src/lib/utils/reviewFieldEvidence.js';

function buildPages(pageNumber, lines) {
	return [{
		pageNumber,
		lines: lines.map((text, index) => ({
			lineNumber: index + 1,
			text
		})),
		text: lines.join('\n')
	}];
}

test('buildReviewFieldEvidenceMap returns page-aware evidence for lending review fields', () => {
	const deal = {
		investment_minimum: 50000,
		financials: 'Audited',
		lp_gp_split: 0.8,
		offering_type: '506(b)',
		investing_states: ['AZ', 'CO', 'TX']
	};

	const documents = {
		ppm: {
			text: [
				'Capital Fund II, LLC',
				'Minimum investment accepted from each investor is $50,000.',
				'80% of Company Net Cash Flow shall be distributed to the Class A Members and 20% to the Class B Member.',
				'Current lending footprint includes Arizona, Colorado, and Texas.'
			].join('\n'),
			pages: buildPages(17, [
				'Capital Fund II, LLC',
				'Minimum investment accepted from each investor is $50,000.',
				'80% of Company Net Cash Flow shall be distributed to the Class A Members and 20% to the Class B Member.',
				'Current lending footprint includes Arizona, Colorado, and Texas.'
			])
		},
		deck: {
			text: [
				'CF2 annual financial audit completed by Armanino LLP.',
				'Expanded footprint: Arizona, Colorado, Texas, Tennessee, Georgia, Utah.'
			].join('\n'),
			pages: buildPages(13, [
				'CF2 annual financial audit completed by Armanino LLP.',
				'Expanded footprint: Arizona, Colorado, Texas, Tennessee, Georgia, Utah.'
			])
		}
	};

	const filing = {
		federal_exemptions: ['06b'],
		edgar_url: 'https://www.sec.gov/example'
	};

	const evidence = buildReviewFieldEvidenceMap({
		deal,
		fieldKeys: ['investmentMinimum', 'financials', 'lpGpSplit', 'offeringType', 'investingStates'],
		documents,
		filing
	});

	assert.equal(evidence.investmentMinimum[0].document, 'ppm');
	assert.equal(evidence.investmentMinimum[0].page, 17);
	assert.match(evidence.investmentMinimum[0].snippet, /\$50,000/);

	assert.equal(evidence.financials[0].document, 'deck');
	assert.equal(evidence.financials[0].page, 13);
	assert.match(evidence.financials[0].snippet.toLowerCase(), /audit/);

	assert.equal(evidence.lpGpSplit[0].sourceType, 'derived');
	assert.match(evidence.lpGpSplit[0].snippet, /80%/);

	assert.equal(evidence.offeringType[0].document, 'sec');
	assert.equal(evidence.offeringType[0].sourceType, 'verified');
	assert.equal(evidence.offeringType[0].url, 'https://www.sec.gov/example');

	assert.equal(evidence.investingStates.length, 2);
	assert.equal(evidence.investingStates[0].document, 'ppm');
	assert.equal(evidence.investingStates[1].document, 'deck');
});

test('buildReviewFieldEvidenceHref formats clickable page links for attached documents', () => {
	const href = buildReviewFieldEvidenceHref(
		{
			document: 'ppm',
			label: 'PPM',
			page: 17,
			line: 2
		},
		{
			ppmUrl: 'https://example.com/capital-fund-2-ppm.pdf'
		}
	);

	assert.equal(href, 'https://example.com/capital-fund-2-ppm.pdf#page=17');
	assert.equal(
		formatReviewFieldEvidenceAnchor({ document: 'ppm', label: 'PPM', page: 17, line: 2 }),
		'PPM · p.17 · line 2'
	);
});

test('getMissingRequiredEvidenceFieldKeys only blocks source-required fields with populated values', () => {
	const missing = getMissingRequiredEvidenceFieldKeys({
		fieldKeys: ['investmentMinimum', 'financials', 'taxForm'],
		source: {
			investmentMinimum: 50000,
			financials: 'Audited',
			taxForm: 'K-1'
		},
		evidence: {
			financials: [
				{
					document: 'deck',
					label: 'Deck',
					page: 13,
					line: 1,
					snippet: 'CF2 annual financial audit completed by Armanino LLP.'
				}
			]
		}
	});

	assert.deepEqual(missing, ['investmentMinimum']);
});

test('buildReviewFieldEvidenceMap matches snapshot dates and leverage ratios from documents', () => {
	const evidence = buildReviewFieldEvidenceMap({
		deal: {
			snapshot_as_of_date: '2025-09-01',
			current_leverage: 0.45,
			max_allowed_leverage: 0.6
		},
		fieldKeys: ['snapshotAsOfDate', 'currentLeverage', 'maxAllowedLeverage'],
		documents: {
			deck: {
				text: [
					'Snapshot as of September 1, 2025.',
					'Current leverage is 0.45x with a maximum leverage ceiling of 0.60x.'
				].join('\n'),
				pages: buildPages(11, [
					'Snapshot as of September 1, 2025.',
					'Current leverage is 0.45x with a maximum leverage ceiling of 0.60x.'
				])
			}
		}
	});

	assert.equal(evidence.snapshotAsOfDate[0].document, 'deck');
	assert.equal(evidence.snapshotAsOfDate[0].page, 11);
	assert.match(evidence.snapshotAsOfDate[0].snippet, /September 1, 2025/);

	assert.equal(evidence.currentLeverage[0].document, 'deck');
	assert.match(evidence.currentLeverage[0].snippet, /0\.45x/);

	assert.equal(evidence.maxAllowedLeverage[0].document, 'deck');
	assert.match(evidence.maxAllowedLeverage[0].snippet, /0\.60x/);
});
