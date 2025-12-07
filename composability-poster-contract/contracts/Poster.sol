// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Poster {
    address public tokenAddress;
    uint256 public threshold;
    address public owner;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event NewPost(address indexed user, string content, bytes32 indexed tag);
    
    constructor(address _tokenAddress, uint256 _threshold) {
        tokenAddress = _tokenAddress;
        threshold = _threshold;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }
    
    modifier onlyOwner() {
        require(owner == msg.sender, "Not owner");
        _;
    }
    
    // Оптимизированная функция post
    function post(string calldata content, string calldata tag) external {
        // Используем calldata вместо memory для строк
        IERC20 token = IERC20(tokenAddress);
        
        // Проверяем баланс
        if (token.balanceOf(msg.sender) < threshold) {
            revert("Not enough tokens");
        }
        
        // Предвычисленный хэш тега
        bytes32 tagHash = keccak256(abi.encodePacked(tag));
        emit NewPost(msg.sender, content, tagHash);
    }
    
    // Остальные функции без изменений
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    function setTokenAddress(address newTokenAddress) external onlyOwner {
        tokenAddress = newTokenAddress;
    }
    
    function setThreshold(uint256 newThreshold) external onlyOwner {
        threshold = newThreshold;
    }
}
