// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract Token is Context, IERC20, IERC20Metadata {
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;
    
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(string memory _name, string memory _symbol, uint256 _totalSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply;
        
        // Назначаем весь баланс создателю контракта
        address creator = _msgSender();
        balances[creator] = _totalSupply;
        
        // Вызываем событие Transfer с адресом 0 как отправителем
        emit Transfer(address(0), creator, _totalSupply);
        
        // Устанавливаем владельца
        owner = _msgSender();
        emit OwnershipTransferred(address(0x0), owner);
    }

    modifier onlyOwner() {
        require(owner == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address _newOwner) public virtual onlyOwner {
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    function mint(address _account, uint256 _amount) public onlyOwner {
        require(_account != address(0), "ERC20: mint to the zero address");
        
        totalSupply += _amount;
        unchecked {
            balances[_account] += _amount;
        }
        
        emit Transfer(address(0), _account, _amount);
    }

    function balanceOf(address account) public view override returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        address from = _msgSender();
        _transfer(from, to, amount);
        return true;
    }

    function allowance(address _owner, address _spender) public view override returns (uint256) {
        return allowances[_owner][_spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        address from = _msgSender();
        _approve(from, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        
        uint256 fromBalance = balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        
        unchecked {
            balances[from] = fromBalance - amount;
            balances[to] += amount;
        }
        
        emit Transfer(from, to, amount);
    }

    function _approve(address _owner, address _spender, uint256 _amount) internal {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(_spender != address(0), "ERC20: approve to the zero address");
        
        allowances[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }

    function _spendAllowance(address _owner, address _spender, uint256 _amount) internal {
        uint256 currentAllowance = allowance(_owner, _spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= _amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(_owner, _spender, currentAllowance - _amount);
            }
        }
    }
}
