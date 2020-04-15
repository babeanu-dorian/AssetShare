var paymentHistory = [
	{
		amount: "10",
		timestamp: "1"
	},
	{
		amount: "10",
		timestamp: "3"
	},
	{
		amount: "10",
		timestamp: "4"
	},
	{
		amount: "10",
		timestamp: "7"
	}
]

var sharesHistory = [
	{
		amount: "40",
		timestamp: "4"
	}
]


function userIncomeHistory() {

    let shares = 0;
    let sharesIdx = 0;
    let nextChangeInShares = (sharesHistory.length == 0 ? Number.MAX_VALUE : parseInt(sharesHistory[0].timestamp));
    let income = [];

    for (let paymentIdx = 0; paymentIdx != paymentHistory.length; ++paymentIdx) {

        while (paymentHistory[paymentIdx].timestamp >= nextChangeInShares) {
            ++sharesIdx;
            nextChangeInShares = (sharesIdx == sharesHistory.length ? Number.MAX_VALUE : parseInt(sharesHistory[sharesIdx].timestamp));
        }

        let shares = (sharesIdx == 0 ? 0 : sharesHistory[sharesIdx - 1].amount);

        income.push({
            amount: shares * paymentHistory[paymentIdx].amount / 100,
            timestamp: paymentHistory[paymentIdx].timestamp
        });
    }

    return income;
}

console.log(userIncomeHistory());