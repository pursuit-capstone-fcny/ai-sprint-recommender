import unittest
from analysis import summarize, gates


class AnalysisTest(unittest.TestCase):
    def row(self, grades, available, **extra):
        return dict(promptId='fixture', grades=grades, availableUseful=available,
                    hardViolations=0, softViolatingCards=0, costUsd=.002,
                    latencyMs=100, costKnown=True, unknownReservedUsd=0,
                    failure=None, validDelivery=True, invalidCards=0,
                    actualEngine='llm', **extra)

    def test_every_returned_card_and_supported_empty_remain_in_denominators(self):
        result = summarize([self.row([3, 1, 0], 2), self.row([], 1), self.row([0], 0)])
        self.assertEqual(result['returnedPrecision'], .25)
        self.assertEqual(result['macroUsefulRecall'], .25)
        self.assertEqual(result['microUsefulRecall'], 1 / 3)
        self.assertEqual(result['usefulFirst'], .5)
        self.assertEqual(result['supportedEmpty'], .5)
        self.assertEqual(result['gapsWithRecommendations'], 1)
        self.assertEqual(result['gradeCounts'], {'3':1,'1':1,'0':2})

    def test_model_only_empty_fallback_cannot_receive_rules_credit(self):
        model = summarize([self.row([], 3)])
        self.assertEqual(model['usefulWithin8'], 0)
        self.assertEqual(model['macroUsefulRecall'], 0)
        self.assertIsNone(model['returnedPrecision'])

    def test_failed_usage_is_reserved_and_reliability_does_not_hide_fallback(self):
        row = self.row([2], 1)
        row.update(failure='timeout', actualEngine='rules', costKnown=False,
                   costUsd=.006556, unknownReservedUsd=.006556)
        result = summarize([row])
        self.assertEqual(result['reliability'], 0)
        self.assertEqual(result['displayDeliveredRate'], 1)
        self.assertEqual(result['fallbacks'], 1)
        self.assertEqual(result['costUsd']['totalConservative'], .006556)
        self.assertEqual(result['unknownCostRequests'], 1)


if __name__ == '__main__':
    unittest.main()
